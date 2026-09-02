import { UniformOrder } from '../models/UniformOrder'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { Agency } from '../models/Agency'
import { User } from '../models/User'
import { SHIRT_SIZES } from '../models/UniformOrder'
import { paymentGatewayService } from './paymentGatewayService'

/** Estados em que o colaborador ainda está no meio do processo do uniforme. */
const OPEN_STATUSES = ['pending_payment', 'paid', 'shipped', 'delivered', 'photo_submitted']

function addressSnapshot(contract: FreelancerContract | null) {
  if (!contract) return null
  return {
    cep: contract.addressCep,
    street: contract.addressStreet,
    number: contract.addressNumber,
    complement: contract.addressComplement,
    neighborhood: contract.addressNeighborhood,
    city: contract.addressCity,
    state: contract.addressState,
  }
}

export const uniformService = {
  async currentForFreelancer(freelancerId: string) {
    return UniformOrder.findOne({
      where: { freelancerId },
      order: [['createdAt', 'DESC']],
    })
  },

  /** Colaborador solicita o uniforme e recebe o link de pagamento. */
  async request(freelancer: FreelancerInstance, shirtSize: string) {
    if (!SHIRT_SIZES.includes(shirtSize as any)) throw new Error('Tamanho de camiseta inválido.')

    const contract = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
    if (!contract?.completedAt) {
      throw new Error('Preencha o perfil contratual antes de comprar o uniforme.')
    }
    const existing = await this.currentForFreelancer(freelancer.id)
    if (existing && OPEN_STATUSES.includes(existing.status) && existing.status !== 'pending_payment') {
      throw new Error('Você já tem um pedido de uniforme em andamento.')
    }

    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
    const amount = Number(agency?.uniformPrice ?? 0)
    if (!(amount > 0)) throw new Error('A agência ainda não definiu o preço do uniforme.')

    const order =
      existing && existing.status === 'pending_payment'
        ? existing
        : await UniformOrder.create({
            freelancerId: freelancer.id,
            shirtSize,
            amount,
            status: 'pending_payment',
            shippingAddress: addressSnapshot(contract),
          })

    if (existing && existing.status === 'pending_payment') {
      await existing.update({ shirtSize, amount, shippingAddress: addressSnapshot(contract) })
    }

    const user = freelancer.userId ? await User.findByPk(freelancer.userId) : null
    const checkout = await paymentGatewayService.createUniformCheckout({
      uniformOrderId: order.id,
      amount,
      buyerEmail: user?.email ?? freelancer.email,
    })
    await order.update({
      paymentProvider: 'mercadopago',
      paymentRef: checkout.preferenceId,
      paymentUrl: checkout.checkoutUrl,
    })
    return order.reload()
  },

  /**
   * Confirma o pagamento consultando o Mercado Pago sob demanda.
   * Usado quando não há webhook público (ambiente local) — o colaborador
   * volta do checkout e a tela de onboarding chama este método.
   */
  async syncPaymentStatus(freelancerId: string, orderId: string) {
    const order = await UniformOrder.findByPk(orderId)
    if (!order || order.freelancerId !== freelancerId) {
      throw new Error('Pedido de uniforme não encontrado.')
    }
    if (order.status !== 'pending_payment') return order
    if (!paymentGatewayService.configured) return order

    const approved = await paymentGatewayService.findApprovedPayment(order.id)
    if (approved) {
      await order.update({ status: 'paid', paidAt: new Date(), paymentRef: approved.id })
    }
    return order.reload()
  },

  /** Webhook do Mercado Pago: confirma o pagamento. */
  async handleWebhook(body: any) {
    const type = body?.type || body?.topic
    const paymentId = body?.data?.id || body?.['data.id'] || body?.resource
    if (type !== 'payment' || !paymentId) return
    const payment = await paymentGatewayService.getPayment(String(paymentId))
    if (payment.status !== 'approved') return
    const orderId = payment.external_reference
    if (!orderId) return
    const order = await UniformOrder.findByPk(orderId)
    if (!order || order.status !== 'pending_payment') return
    await order.update({ status: 'paid', paidAt: new Date(), paymentRef: String(paymentId) })
  },

  async markShipped(id: string, agencyId: string, trackingCode?: string) {
    const order = await this.assertAgencyOrder(id, agencyId)
    if (order.status !== 'paid') throw new Error('Só é possível enviar um uniforme pago.')
    await order.update({ status: 'shipped', shippedAt: new Date(), trackingCode: trackingCode?.trim() || null })
    return order
  },

  async markReceived(id: string, freelancer: FreelancerInstance) {
    const order = await UniformOrder.findByPk(id)
    if (!order || order.freelancerId !== freelancer.id) throw new Error('Pedido de uniforme não encontrado.')
    if (order.status !== 'shipped') throw new Error('O uniforme ainda não foi enviado.')
    await order.update({ status: 'delivered', deliveredAt: new Date() })
    return order
  },

  async submitSelfie(id: string, freelancer: FreelancerInstance, photoUrl: string) {
    const order = await UniformOrder.findByPk(id)
    if (!order || order.freelancerId !== freelancer.id) throw new Error('Pedido de uniforme não encontrado.')
    if (!['delivered', 'photo_submitted', 'rejected'].includes(order.status)) {
      throw new Error('Confirme o recebimento do uniforme antes de enviar a selfie.')
    }
    await order.update({ status: 'photo_submitted', selfiePhotoUrl: photoUrl, rejectionReason: null })
    return order
  },

  async review(id: string, agencyId: string, data: { approved: boolean; reason?: string }) {
    const order = await this.assertAgencyOrder(id, agencyId)
    if (order.status !== 'photo_submitted') throw new Error('Não há selfie para revisar neste pedido.')
    if (data.approved) {
      await order.update({ status: 'approved', reviewedAt: new Date(), rejectionReason: null })
      await Freelancer.update(
        { onboardingApprovedAt: new Date() },
        { where: { id: order.freelancerId } }
      )
    } else {
      if (!data.reason?.trim()) throw new Error('Informe o motivo da recusa.')
      await order.update({ status: 'rejected', reviewedAt: new Date(), rejectionReason: data.reason.trim() })
    }
    return order
  },

  /** Pedidos de uniforme dos colaboradores da agência (para as telas de pendência). */
  async listForAgency(agencyId: string) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id', 'name'] })
    const byId = new Map(freelancers.map((f) => [f.id, f.name]))
    const orders = await UniformOrder.findAll({
      where: { freelancerId: [...byId.keys()] },
      order: [['createdAt', 'DESC']],
    })
    return orders.map((o) => ({ ...o.toJSON(), freelancerName: byId.get(o.freelancerId) ?? null }))
  },

  async assertAgencyOrder(id: string, agencyId: string) {
    const order = await UniformOrder.findByPk(id)
    if (!order) throw new Error('Pedido de uniforme não encontrado.')
    const freelancer = await Freelancer.findByPk(order.freelancerId)
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este colaborador não pertence à sua agência.')
    }
    return order
  },
}
