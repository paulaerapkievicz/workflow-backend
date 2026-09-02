import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3333'
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000'

/**
 * O Mercado Pago recusa `notification_url`/`auto_return` que apontem para
 * `localhost` (ou outro host não acessível pela internet). Em dev sem túnel
 * público, geramos o checkout sem esses campos — o pedido fica em
 * `pending_payment` até a confirmação manual/webhook.
 */
function isPublicUrl(url: string): boolean {
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)(:|\/|$)/i.test(url)
}

function client() {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Pagamento indisponível: configure MP_ACCESS_TOKEN (Mercado Pago) no servidor.')
  }
  return new MercadoPagoConfig({ accessToken })
}

export const paymentGatewayService = {
  get configured() {
    return !!process.env.MP_ACCESS_TOKEN
  },

  /** Cria uma preferência de checkout (Checkout Pro) para o kit uniforme. */
  async createUniformCheckout(params: { uniformOrderId: string; amount: number; buyerEmail?: string }) {
    const pref = new Preference(client())
    const back = `${FRONTEND_BASE_URL}/freelancer/onboarding`
    const webhookPublic = isPublicUrl(APP_BASE_URL)
    const backPublic = isPublicUrl(FRONTEND_BASE_URL)
    const res = await pref.create({
      body: {
        items: [
          {
            id: params.uniformOrderId,
            title: 'Kit uniforme',
            quantity: 1,
            unit_price: Number(params.amount),
            currency_id: 'BRL',
          },
        ],
        payer: params.buyerEmail ? { email: params.buyerEmail } : undefined,
        external_reference: params.uniformOrderId,
        // O redirect de volta funciona no navegador do usuário mesmo em localhost.
        back_urls: {
          success: `${back}?uniform=success`,
          failure: `${back}?uniform=failure`,
          pending: `${back}?uniform=pending`,
        },
        // `auto_return` e `notification_url` são validados pelo MP e exigem URL pública.
        ...(backPublic ? { auto_return: 'approved' as const } : {}),
        ...(webhookPublic
          ? { notification_url: `${APP_BASE_URL}/payments/mercadopago/webhook` }
          : {}),
      },
    })
    return {
      preferenceId: res.id as string,
      checkoutUrl: (res.sandbox_init_point || res.init_point) as string,
    }
  },

  /** Consulta um pagamento pelo id (usado pelo webhook). */
  async getPayment(paymentId: string) {
    const payment = new Payment(client())
    return payment.get({ id: paymentId })
  },

  /**
   * Procura um pagamento aprovado para a `external_reference` informada.
   * Usado para confirmar o pedido quando não há webhook público (dev local).
   */
  async findApprovedPayment(externalReference: string) {
    const payment = new Payment(client())
    const res = await payment.search({
      options: { external_reference: externalReference, sort: 'date_created', criteria: 'desc' },
    })
    const approved = (res.results ?? []).find((p) => p.status === 'approved')
    return approved ? { id: String(approved.id) } : null
  },
}
