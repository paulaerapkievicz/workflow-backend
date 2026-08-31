import { Op } from 'sequelize'
import { sequelize } from '../database'
import { Order } from '../models/Order'
import { OrderItem, OrderItemShiftTemplate } from '../models/OrderItem'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { Branch } from '../models/Branch'
import { Category } from '../models/Category'
import { Supermarket } from '../models/Supermarket'
import { Freelancer } from '../models/Freelancer'
import { minutesBetween } from '../helpers/time'
import { UserInstance } from '../models/User'
import { profileService } from './profileService'

const orderIncludes = [
  { model: Supermarket, as: 'orderSupermarket' },
  { model: Branch, as: 'orderBranch' },
  { model: OrderItem, as: 'items', include: [{ model: Category, as: 'itemCategory' }] },
  {
    model: Job,
    as: 'orderJobs',
    include: [
      { model: JobShift, as: 'shifts' },
      { model: Category, as: 'jobCategory' },
      { model: Freelancer, as: 'assignedFreelancer' },
    ],
  },
]

interface ShiftInput {
  startTime: string
  endTime: string
  label?: string | null
}

function normalizeShifts(raw: any, ctx: string): ShiftInput[] {
  const list: any[] = Array.isArray(raw) ? raw : []
  if (!list.length) throw new Error(`${ctx}: informe ao menos um turno.`)
  return list.map((s, i) => {
    if (!s.startTime || !s.endTime) throw new Error(`${ctx} · turno ${i + 1}: informe início e fim.`)
    if (new Date(s.endTime) <= new Date(s.startTime)) {
      throw new Error(`${ctx} · turno ${i + 1}: o fim precisa ser depois do início.`)
    }
    return { startTime: s.startTime, endTime: s.endTime, label: s.label ?? null }
  })
}

export const orderService = {
  async findById(id: string) {
    return Order.findByPk(id, { include: orderIncludes })
  },

  async listForUser(user: UserInstance) {
    if (user.role === 'admin') {
      return Order.findAll({ include: orderIncludes, order: [['createdAt', 'DESC']] })
    }
    if (user.role === 'supermarket') {
      const supermarketId = await profileService.supermarketIdForUser(user)
      if (!supermarketId) return []
      return Order.findAll({ where: { supermarketId }, include: orderIncludes, order: [['createdAt', 'DESC']] })
    }
    if (user.role === 'agency') {
      // Agência enxerga todos os pedidos: pool de vagas + acompanhamento das que sua rede assumiu.
      return Order.findAll({ include: orderIncludes, order: [['createdAt', 'DESC']] })
    }
    return []
  },

  async create(data: any, supermarketId: string) {
    const branch = await Branch.findByPk(data.branchId)
    if (!branch || branch.supermarketId !== supermarketId) {
      throw new Error('Filial inválida para o seu supermercado.')
    }
    const rawItems: any[] = Array.isArray(data.items) ? data.items : []
    if (!rawItems.length) throw new Error('Adicione ao menos um item ao pedido.')

    const items = rawItems.map((it, idx) => {
      const ctx = `Item ${idx + 1}`
      if (!it.categoryId) throw new Error(`${ctx}: informe a função (categoria).`)
      if (!it.title) throw new Error(`${ctx}: informe um título.`)
      const quantity = Math.trunc(Number(it.quantity) || 0)
      if (quantity < 1) throw new Error(`${ctx}: a quantidade precisa ser ao menos 1.`)
      if (quantity > 100) throw new Error(`${ctx}: quantidade máxima por item é 100.`)
      const shifts = normalizeShifts(it.shifts, ctx)
      return {
        categoryId: it.categoryId as string,
        title: it.title as string,
        description: (it.description ?? null) as string | null,
        quantity,
        photosRequired: it.photosRequired !== false,
        agencyReviewEnabled: it.agencyReviewEnabled === true,
        shifts,
      }
    })

    const categoryIds = [...new Set(items.map((i) => i.categoryId))]
    const foundCats = await Category.findAll({ where: { id: { [Op.in]: categoryIds } }, attributes: ['id'] })
    if (foundCats.length !== categoryIds.length) throw new Error('Uma das funções (categorias) é inválida.')

    const order = await sequelize.transaction(async (t) => {
      const createdOrder = await Order.create(
        { supermarketId, branchId: data.branchId, notes: data.notes ?? null, status: 'open' },
        { transaction: t }
      )

      for (const item of items) {
        const createdItem = await OrderItem.create(
          {
            orderId: createdOrder.id,
            categoryId: item.categoryId,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            photosRequired: item.photosRequired,
            agencyReviewEnabled: item.agencyReviewEnabled,
            shifts: item.shifts as OrderItemShiftTemplate[],
          },
          { transaction: t }
        )

        const starts = item.shifts.map((s) => new Date(s.startTime).getTime())
        const ends = item.shifts.map((s) => new Date(s.endTime).getTime())
        const contractedMinutes = item.shifts.reduce(
          (acc, s) => acc + minutesBetween(s.startTime, s.endTime),
          0
        )

        for (let n = 0; n < item.quantity; n++) {
          const job = await Job.create(
            {
              supermarketId,
              branchId: data.branchId,
              categoryId: item.categoryId,
              orderId: createdOrder.id,
              orderItemId: createdItem.id,
              title: item.quantity > 1 ? `${item.title} (${n + 1}/${item.quantity})` : item.title,
              description: item.description,
              status: 'pending',
              freelancerId: null,
              startTime: new Date(Math.min(...starts)),
              endTime: new Date(Math.max(...ends)),
              contractedMinutes,
              photosRequired: item.photosRequired,
              agencyReviewEnabled: item.agencyReviewEnabled,
            },
            { transaction: t }
          )
          await JobShift.bulkCreate(
            item.shifts.map((s, i) => ({
              jobId: job.id,
              position: i,
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime),
              label: s.label ?? null,
            })),
            { transaction: t }
          )
        }
      }

      return createdOrder
    })

    return this.findById(order.id)
  },

  async cancel(id: string, supermarketId: string) {
    const order = await Order.findByPk(id, { include: [{ model: Job, as: 'orderJobs' }] })
    if (!order) throw new Error('Pedido não encontrado.')
    if (order.supermarketId !== supermarketId) throw new Error('Pedido não pertence ao seu supermercado.')
    if (order.status === 'canceled') throw new Error('Pedido já cancelado.')

    await sequelize.transaction(async (t) => {
      await Job.update(
        { status: 'canceled' },
        { where: { orderId: id, status: 'pending' }, transaction: t }
      )
      const remaining = await Job.count({
        where: { orderId: id, status: { [Op.notIn]: ['canceled', 'completed'] } },
        transaction: t,
      })
      await order.update({ status: remaining > 0 ? order.status : 'canceled' }, { transaction: t })
    })
    return this.findById(id)
  },

  /** Reavalia o status do pedido a partir das vagas (chamado após mudanças de vaga). */
  async syncStatus(orderId: string | null | undefined) {
    if (!orderId) return
    const order = await Order.findByPk(orderId)
    if (!order || order.status === 'canceled') return
    const jobs = await Job.findAll({ where: { orderId }, attributes: ['status'] })
    if (!jobs.length) return
    const active = jobs.filter((j) => j.status !== 'canceled')
    if (!active.length) {
      await order.update({ status: 'canceled' })
      return
    }
    if (active.every((j) => j.status === 'completed')) {
      await order.update({ status: 'completed' })
    } else if (active.some((j) => ['accepted', 'in_progress', 'completed'].includes(j.status))) {
      await order.update({ status: 'in_progress' })
    } else {
      await order.update({ status: 'open' })
    }
  },
}
