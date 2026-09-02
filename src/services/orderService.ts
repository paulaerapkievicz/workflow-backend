import { Op, Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Order } from '../models/Order'
import { OrderItem, OrderItemShiftTemplate } from '../models/OrderItem'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobLog } from '../models/JobLog'
import { Branch } from '../models/Branch'
import { Category } from '../models/Category'
import { Supermarket } from '../models/Supermarket'
import { Freelancer } from '../models/Freelancer'
import { minutesBetween } from '../helpers/time'
import { resolveShifts, ResolvedShift, ShiftPeriod } from '../helpers/shifts'
import { UserInstance } from '../models/User'
import { profileService, SupermarketContext } from './profileService'

/** Contexto de quem cria/edita o pedido (dono ou gerente de loja). */
export type OrderContext = SupermarketContext & { userId: string }

const orderIncludes = [
  { model: Supermarket, as: 'orderSupermarket' },
  { model: Branch, as: 'orderBranch' },
  {
    model: OrderItem,
    as: 'items',
    include: [
      { model: Category, as: 'itemCategory' },
      { model: Branch, as: 'itemBranch' },
    ],
  },
  {
    model: Job,
    as: 'orderJobs',
    include: [
      { model: JobShift, as: 'shifts' },
      { model: Category, as: 'jobCategory' },
      { model: Freelancer, as: 'assignedFreelancer' },
      { model: JobLog, as: 'jobLogs' },
    ],
  },
]

interface NormalizedItem {
  categoryId: string
  categoryName: string
  branchId: string
  branchName: string
  title: string
  quantity: number
  /** Turno principal (primeiro do dia) — mantido para compatibilidade / filtros. */
  shiftPeriod: ShiftPeriod
  /** Um ou mais turnos da vaga, já resolvidos e ordenados por horário. */
  shifts: ResolvedShift[]
  /** Início do primeiro turno e fim do último — janela total da vaga. */
  startTime: Date
  endTime: Date
}

/** Aceita o formato novo (`shifts: [...]`) e o legado (`shiftPeriod`/`startTime`/`endTime`). */
function rawShiftsOf(item: any) {
  if (Array.isArray(item?.shifts) && item.shifts.length) return item.shifts
  return [{ shiftPeriod: item?.shiftPeriod, startTime: item?.startTime, endTime: item?.endTime }]
}

async function normalizeItems(rawItems: any[], supermarketId: string): Promise<NormalizedItem[]> {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('Adicione ao menos uma vaga ao pedido.')

  const categoryIds = [...new Set(rawItems.map((i) => i?.categoryId).filter(Boolean))]
  const cats = await Category.findAll({ where: { id: { [Op.in]: categoryIds } } })
  const catById = new Map(cats.map((c) => [c.id, c]))

  const branchIds = [...new Set(rawItems.map((i) => i?.branchId).filter(Boolean))]
  const branches = await Branch.findAll({ where: { id: { [Op.in]: branchIds } } })
  const branchById = new Map(branches.map((b) => [b.id, b]))

  return rawItems.map((it, idx) => {
    const ctx = `Item ${idx + 1}`
    const category = catById.get(it?.categoryId)
    if (!category) throw new Error(`${ctx}: função (categoria) inválida.`)
    const branch = branchById.get(it?.branchId)
    if (!branch) throw new Error(`${ctx}: informe a filial da vaga.`)
    if (branch.supermarketId !== supermarketId) throw new Error(`${ctx}: filial inválida para o seu supermercado.`)
    if (!it?.date) throw new Error(`${ctx}: informe a data.`)

    const quantity = Math.trunc(Number(it.quantity) || 0)
    if (quantity < 1) throw new Error(`${ctx}: a quantidade precisa ser ao menos 1.`)
    if (quantity > 100) throw new Error(`${ctx}: quantidade máxima por item é 100.`)

    let shifts: ResolvedShift[]
    try {
      shifts = resolveShifts(rawShiftsOf(it), String(it.date))
    } catch (err) {
      throw new Error(`${ctx}: ${(err as Error).message}`)
    }

    const title =
      (it.title && String(it.title).trim()) || `${category.name} - ${branch.name}`

    return {
      categoryId: category.id,
      categoryName: category.name,
      branchId: branch.id,
      branchName: branch.name,
      title,
      quantity,
      shiftPeriod: shifts[0].shiftPeriod,
      shifts,
      startTime: shifts[0].startTime,
      endTime: shifts[shifts.length - 1].endTime,
    }
  })
}

async function createJobsForItems(
  orderId: string,
  supermarketId: string,
  items: NormalizedItem[],
  jobStatus: 'pending' | 'awaiting_approval',
  t: Transaction
) {
  for (const item of items) {
    const createdItem = await OrderItem.create(
      {
        orderId,
        categoryId: item.categoryId,
        branchId: item.branchId,
        title: item.title,
        quantity: item.quantity,
        shiftPeriod: item.shiftPeriod,
        shifts: item.shifts.map((s) => ({
          shiftPeriod: s.shiftPeriod,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
          label: s.label,
        })) as OrderItemShiftTemplate[],
      },
      { transaction: t }
    )

    const contractedMinutes = item.shifts.reduce(
      (acc, s) => acc + minutesBetween(s.startTime, s.endTime),
      0
    )

    for (let n = 0; n < item.quantity; n++) {
      const job = await Job.create(
        {
          supermarketId,
          branchId: item.branchId,
          categoryId: item.categoryId,
          orderId,
          orderItemId: createdItem.id,
          shiftPeriod: item.shiftPeriod,
          title: item.quantity > 1 ? `${item.title} (${n + 1}/${item.quantity})` : item.title,
          status: jobStatus,
          freelancerId: null,
          startTime: item.startTime,
          endTime: item.endTime,
          contractedMinutes,
        },
        { transaction: t }
      )
      for (let position = 0; position < item.shifts.length; position++) {
        const s = item.shifts[position]
        await JobShift.create(
          { jobId: job.id, position, startTime: s.startTime, endTime: s.endTime, label: s.label },
          { transaction: t }
        )
      }
    }
  }
}

// Mantém as vagas do pedido em ordem estável (título "… (1/3)", "(2/3)", …).
const orderJobsOrder: any = [[{ model: Job, as: 'orderJobs' }, 'title', 'ASC']]

export const orderService = {
  async findById(id: string) {
    return Order.findByPk(id, { include: orderIncludes, order: orderJobsOrder })
  },

  async listForUser(user: UserInstance) {
    if (user.role === 'admin') {
      return Order.findAll({ include: orderIncludes, order: [['createdAt', 'DESC'], ...orderJobsOrder] })
    }
    if (user.role === 'supermarket') {
      const ctx = await profileService.supermarketContextForUser(user)
      if (!ctx) return []
      const where: any = { supermarketId: ctx.supermarketId }
      const all = await Order.findAll({ where, include: orderIncludes, order: [['createdAt', 'DESC'], ...orderJobsOrder] })
      // Gerente restrito a uma loja só vê pedidos com vaga/item daquela loja.
      if (!ctx.branchId) return all
      return all.filter(
        (o) =>
          (o as any).items?.some((it: any) => it.branchId === ctx.branchId) ||
          (o as any).orderJobs?.some((j: any) => j.branchId === ctx.branchId)
      )
    }
    if (user.role === 'agency') {
      return Order.findAll({ include: orderIncludes, order: [['createdAt', 'DESC'], ...orderJobsOrder] })
    }
    return []
  },

  /** Se o gerente é de uma loja, todas as vagas do pedido são forçadas para essa filial. */
  scopeItems(rawItems: any[], ctx: OrderContext) {
    if (!ctx.canSubmitOrders) throw new Error('Você não tem permissão para solicitar vagas.')
    if (!ctx.branchId) return rawItems
    return (rawItems ?? []).map((it) => ({ ...it, branchId: ctx.branchId }))
  },

  async create(data: any, ctx: OrderContext) {
    const rawItems = this.scopeItems(data.items, ctx)
    const items = await normalizeItems(rawItems, ctx.supermarketId)
    // Filial "principal" do pedido = a do primeiro item (cada vaga carrega a própria).
    const primaryBranchId = items[0].branchId
    const approvalStatus = ctx.canApproveOrders ? 'approved' : 'pending_approval'
    const jobStatus = approvalStatus === 'approved' ? 'pending' : 'awaiting_approval'

    const order = await sequelize.transaction(async (t) => {
      const createdOrder = await Order.create(
        {
          supermarketId: ctx.supermarketId,
          branchId: primaryBranchId,
          notes: data.notes ?? null,
          status: 'open',
          approvalStatus,
          submittedByUserId: ctx.userId,
          approvedByUserId: approvalStatus === 'approved' ? ctx.userId : null,
        },
        { transaction: t }
      )
      await createJobsForItems(createdOrder.id, ctx.supermarketId, items, jobStatus, t)
      return createdOrder
    })
    return this.findById(order.id)
  },

  /** Adiciona novas vagas a um pedido já enviado (não pode ser cancelado/concluído). */
  async addItems(orderId: string, rawItems: any[], ctx: OrderContext) {
    const order = await Order.findByPk(orderId)
    if (!order) throw new Error('Pedido não encontrado.')
    if (order.supermarketId !== ctx.supermarketId) throw new Error('Pedido não pertence ao seu supermercado.')
    if (['canceled', 'completed'].includes(order.status)) {
      throw new Error('Não é possível adicionar vagas a um pedido cancelado ou concluído.')
    }
    const items = await normalizeItems(this.scopeItems(rawItems, ctx), ctx.supermarketId)
    // Vagas herdam o estado de aprovação do pedido.
    const jobStatus = order.approvalStatus === 'approved' ? 'pending' : 'awaiting_approval'

    await sequelize.transaction(async (t) => {
      await createJobsForItems(order.id, ctx.supermarketId, items, jobStatus, t)
    })
    await this.syncStatus(order.id)
    return this.findById(order.id)
  },

  /** Aprovador libera o pedido: as vagas entram no pool. */
  async approve(orderId: string, ctx: OrderContext) {
    if (!ctx.canApproveOrders) throw new Error('Você não tem permissão para aprovar pedidos.')
    const order = await Order.findByPk(orderId)
    if (!order || order.supermarketId !== ctx.supermarketId) throw new Error('Pedido não encontrado.')
    if (order.approvalStatus !== 'pending_approval') throw new Error('Este pedido não está aguardando aprovação.')
    await sequelize.transaction(async (t) => {
      await Job.update(
        { status: 'pending' },
        { where: { orderId, status: 'awaiting_approval' }, transaction: t }
      )
      await order.update(
        { approvalStatus: 'approved', approvedByUserId: ctx.userId, rejectionReason: null },
        { transaction: t }
      )
    })
    await this.syncStatus(orderId)
    return this.findById(orderId)
  },

  /** Aprovador recusa o pedido: as vagas são canceladas. */
  async reject(orderId: string, ctx: OrderContext, reason?: string) {
    if (!ctx.canApproveOrders) throw new Error('Você não tem permissão para aprovar pedidos.')
    const order = await Order.findByPk(orderId)
    if (!order || order.supermarketId !== ctx.supermarketId) throw new Error('Pedido não encontrado.')
    if (order.approvalStatus !== 'pending_approval') throw new Error('Este pedido não está aguardando aprovação.')
    await sequelize.transaction(async (t) => {
      await Job.update(
        { status: 'canceled' },
        { where: { orderId, status: 'awaiting_approval' }, transaction: t }
      )
      await order.update(
        {
          approvalStatus: 'rejected',
          approvedByUserId: ctx.userId,
          rejectionReason: reason?.trim() || 'Pedido recusado.',
          status: 'canceled',
        },
        { transaction: t }
      )
    })
    return this.findById(orderId)
  },

  async cancel(id: string, supermarketId: string) {
    const order = await Order.findByPk(id)
    if (!order) throw new Error('Pedido não encontrado.')
    if (order.supermarketId !== supermarketId) throw new Error('Pedido não pertence ao seu supermercado.')
    if (order.status === 'canceled') throw new Error('Pedido já cancelado.')

    await sequelize.transaction(async (t) => {
      await Job.update(
        { status: 'canceled' },
        { where: { orderId: id, status: { [Op.in]: ['pending', 'awaiting_approval'] } }, transaction: t }
      )
      const remaining = await Job.count({
        where: { orderId: id, status: { [Op.notIn]: ['canceled', 'completed'] } },
        transaction: t,
      })
      await order.update({ status: remaining > 0 ? order.status : 'canceled' }, { transaction: t })
    })
    return this.findById(id)
  },

  async syncStatus(orderId: string | null | undefined) {
    if (!orderId) return
    const order = await Order.findByPk(orderId)
    if (!order || order.status === 'canceled') return
    if (order.approvalStatus !== 'approved') return // ainda aguardando aprovação
    const jobs = await Job.findAll({ where: { orderId }, attributes: ['status'] })
    if (!jobs.length) return
    const active = jobs.filter((j) => !['canceled', 'awaiting_approval'].includes(j.status))
    if (!active.length && jobs.some((j) => j.status === 'awaiting_approval')) return
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
