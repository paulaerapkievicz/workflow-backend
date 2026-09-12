import { Op, Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Review } from '../models/Review'
import { Job } from '../models/Job'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { Agency } from '../models/Agency'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Includes para trazer dados da vaga/colaborador em cada linha de avaliação. */
const reviewRowIncludes = [
  { model: Freelancer, as: 'reviewedFreelancer', attributes: ['id', 'name'] },
  {
    model: Job,
    as: 'reviewedJob',
    attributes: ['id', 'title'],
    include: [
      { model: Category, as: 'jobCategory', attributes: ['name'] },
      { model: Branch, as: 'jobBranch', attributes: ['name'] },
    ],
  },
]

/** Linha de avaliação para as telas da agência (nota + comentário + contexto da vaga). */
function serializeReviewRow(r: any) {
  const job = r.reviewedJob
  return {
    id: r.id,
    jobId: r.jobId,
    freelancerId: r.freelancerId,
    freelancerName: r.reviewedFreelancer?.name ?? null,
    rating: r.rating,
    comment: r.comment ?? null,
    authorRole: r.authorRole ?? null,
    approved: r.approved ?? null,
    createdAt: r.createdAt,
    jobTitle: job?.title ?? null,
    categoryName: job?.jobCategory?.name ?? null,
    branchName: job?.jobBranch?.name ?? null,
  }
}

/** Recalcula a média/contador de reputação do colaborador ao incluir mais uma nota. */
async function applyRatingToFreelancer(
  freelancer: FreelancerInstance,
  rating: number,
  t: Transaction
) {
  const count = Number(freelancer.ratingCount) + 1
  const prevAvg = Number(freelancer.ratingAvg || 0)
  const newAvg = round2((prevAvg * Number(freelancer.ratingCount) + rating) / count)
  await freelancer.update({ ratingCount: count, ratingAvg: newAvg }, { transaction: t })
}

/** Avaliação de entrega vale quando a agência liga o recurso (com override opcional por vaga). */
function resolveReviewEnabled(job: { reviewEnabled?: boolean | null }, agency: { reviewEnabled?: boolean | null } | null) {
  return job.reviewEnabled ?? agency?.reviewEnabled ?? false
}

export const reviewService = {
  async getAll() {
    return Review.findAll({ order: [['createdAt', 'DESC']] })
  },

  /**
   * Avaliações de uma vaga, filtradas por papel:
   * - agency/leader/admin (da rede): todas (nota da agência + do supermercado);
   * - supermarket (dono da vaga): só as que ele mesmo publicou;
   * - freelancer: barrado (o colaborador só vê a média).
   */
  async getByJob(jobId: string, opts: { role?: string; supermarketId?: string | null } = {}) {
    const { role, supermarketId } = opts
    if (role === 'freelancer') throw new Error('O colaborador vê apenas a nota média.')

    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')

    const where: any = { jobId }
    if (role === 'supermarket') {
      if (job.supermarketId !== supermarketId) throw new Error('Vaga não encontrada.')
      where.authorRole = 'supermarket'
    }
    return Review.findAll({ where, order: [['createdAt', 'DESC']], include: reviewRowIncludes })
  },

  async getByFreelancerId(freelancerId: string) {
    return Review.findAll({
      where: { freelancerId },
      order: [['createdAt', 'DESC']],
      include: reviewRowIncludes,
    })
  },

  /**
   * Todas as avaliações dos colaboradores de uma agência (para a tela "Avaliações"),
   * opcionalmente filtradas por colaborador ou por vaga. Respeita o escopo do líder.
   */
  async listForAgency(
    agencyId: string,
    opts: { freelancerId?: string | null; jobId?: string | null; scopeFreelancerIds?: string[] | null } = {}
  ) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id', 'name'] })
    let ids = freelancers.map((f) => f.id)
    if (opts.scopeFreelancerIds) ids = ids.filter((id) => opts.scopeFreelancerIds!.includes(id))
    if (opts.freelancerId) ids = ids.filter((id) => id === opts.freelancerId)
    if (!ids.length) return []

    const where: any = { freelancerId: { [Op.in]: ids } }
    if (opts.jobId) where.jobId = opts.jobId

    const rows = await Review.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: reviewRowIncludes,
    })
    return rows.map(serializeReviewRow)
  },

  // Avaliação da entrega feita pela agência (só reputação; não mexe em status/dinheiro).
  async createDeliveryReview(
    jobId: string,
    agencyId: string,
    data: { rating: number; comment?: string; approved: boolean }
  ) {
    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.status !== 'completed') throw new Error('A vaga precisa estar concluída para ser avaliada.')
    if (!job.freelancerId) throw new Error('Vaga sem freelancer.')

    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Colaborador não encontrado.')
    }

    // A avaliação é uma decisão da agência (config), com override opcional por vaga.
    const agency = await Agency.findByPk(agencyId)
    if (!resolveReviewEnabled(job, agency)) {
      throw new Error('Ative a avaliação de entregas nas configurações da agência.')
    }

    const rating = Number(data.rating)
    if (!(rating >= 1 && rating <= 5)) throw new Error('A nota deve ser de 1 a 5.')
    if (data.approved === false && !data.comment?.trim()) {
      throw new Error('Ao rejeitar, informe o motivo.')
    }

    const existing = await Review.findOne({ where: { jobId, authorRole: 'agency' } })
    if (existing) throw new Error('Esta entrega já foi avaliada pela agência.')

    return sequelize.transaction(async (t) => {
      const review = await Review.create(
        {
          jobId,
          freelancerId: freelancer.id,
          rating,
          comment: data.comment?.trim() || null,
          authorRole: 'agency',
          approved: data.approved,
        },
        { transaction: t }
      )
      await applyRatingToFreelancer(freelancer, rating, t)
      return review
    })
  },

  // Avaliação da entrega feita pelo supermercado (cliente). Mesma média do colaborador;
  // sem semântica de aprovar/rejeitar — é só nota + comentário.
  async createSupermarketReview(
    jobId: string,
    supermarketId: string,
    data: { rating: number; comment?: string }
  ) {
    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.supermarketId !== supermarketId) throw new Error('Vaga não encontrada.')
    if (job.status !== 'completed') throw new Error('A vaga precisa estar concluída para ser avaliada.')
    if (!job.freelancerId) throw new Error('Vaga sem colaborador.')

    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer) throw new Error('Colaborador não encontrado.')

    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
    if (!resolveReviewEnabled(job, agency)) {
      throw new Error('A agência não habilitou a avaliação de colaboradores.')
    }

    const rating = Number(data.rating)
    if (!(rating >= 1 && rating <= 5)) throw new Error('A nota deve ser de 1 a 5.')

    const existing = await Review.findOne({ where: { jobId, authorRole: 'supermarket' } })
    if (existing) throw new Error('Você já avaliou este colaborador nesta vaga.')

    return sequelize.transaction(async (t) => {
      const review = await Review.create(
        {
          jobId,
          freelancerId: freelancer.id,
          rating,
          comment: data.comment?.trim() || null,
          authorRole: 'supermarket',
          approved: null,
        },
        { transaction: t }
      )
      await applyRatingToFreelancer(freelancer, rating, t)
      return review
    })
  },

  /**
   * Reputação agregada do colaborador: nota média, nº de avaliações, convocações concluídas,
   * horas trabalhadas e as avaliações mais recentes (com dados da vaga).
   */
  async reputationForFreelancer(freelancerId: string, opts: { includeReviews?: boolean } = {}) {
    const freelancer = await Freelancer.findByPk(freelancerId)
    if (!freelancer) throw new Error('Colaborador não encontrado.')

    const completedJobs = await Job.count({ where: { freelancerId, status: 'completed' } })
    const workedMinutes = Number(
      (await Job.sum('workedMinutes', { where: { freelancerId, status: 'completed' } })) || 0
    )

    // O colaborador e o supermercado só enxergam a média — a lista de avaliações
    // individuais (com comentários) é exclusiva da agência.
    if (!opts.includeReviews) {
      return {
        ratingAvg: freelancer.ratingAvg == null ? null : Number(freelancer.ratingAvg),
        ratingCount: Number(freelancer.ratingCount),
        completedJobs,
        workedMinutes,
        reviews: [] as unknown[],
      }
    }

    const reviews = await Review.findAll({
      where: { freelancerId },
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [
        {
          model: Job,
          as: 'reviewedJob',
          include: [
            { model: Category, as: 'jobCategory' },
            { model: Branch, as: 'jobBranch' },
          ],
        },
      ],
    })

    return {
      ratingAvg: freelancer.ratingAvg == null ? null : Number(freelancer.ratingAvg),
      ratingCount: Number(freelancer.ratingCount),
      completedJobs,
      workedMinutes,
      reviews: reviews.map((r) => {
        const job = (r as any).reviewedJob
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment ?? null,
          authorRole: r.authorRole ?? null,
          createdAt: r.createdAt,
          jobTitle: job?.title ?? null,
          categoryName: job?.jobCategory?.name ?? null,
          branchName: job?.jobBranch?.name ?? null,
        }
      }),
    }
  },
}
