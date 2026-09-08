import { Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Review } from '../models/Review'
import { Job } from '../models/Job'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { Agency } from '../models/Agency'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

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

  /** Todas as avaliações de uma vaga (agência e/ou supermercado). */
  async getByJob(jobId: string) {
    return Review.findAll({ where: { jobId }, order: [['createdAt', 'DESC']] })
  },

  async getByFreelancerId(freelancerId: string) {
    return Review.findAll({ where: { freelancerId }, order: [['createdAt', 'DESC']] })
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
      throw new Error('Este freelancer não pertence à sua agência.')
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
    if (job.supermarketId !== supermarketId) throw new Error('Esta vaga não pertence ao seu supermercado.')
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
  async reputationForFreelancer(freelancerId: string) {
    const freelancer = await Freelancer.findByPk(freelancerId)
    if (!freelancer) throw new Error('Colaborador não encontrado.')

    const completedJobs = await Job.count({ where: { freelancerId, status: 'completed' } })
    const workedMinutes = Number(
      (await Job.sum('workedMinutes', { where: { freelancerId, status: 'completed' } })) || 0
    )

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
