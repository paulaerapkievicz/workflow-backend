import { sequelize } from '../database'
import { Review } from '../models/Review'
import { Job } from '../models/Job'
import { Freelancer } from '../models/Freelancer'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const reviewService = {
  async getAll() {
    return Review.findAll({ order: [['createdAt', 'DESC']] })
  },

  async getByJob(jobId: string) {
    return Review.findOne({ where: { jobId } })
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
    if (!job.agencyReviewEnabled) throw new Error('Esta vaga não tem avaliação da agência habilitada.')
    if (job.status !== 'completed') throw new Error('A vaga precisa estar concluída para ser avaliada.')
    if (!job.freelancerId) throw new Error('Vaga sem freelancer.')

    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este freelancer não pertence à sua agência.')
    }

    const rating = Number(data.rating)
    if (!(rating >= 1 && rating <= 5)) throw new Error('A nota deve ser de 1 a 5.')
    if (data.approved === false && !data.comment?.trim()) {
      throw new Error('Ao rejeitar, informe o motivo.')
    }

    const existing = await Review.findOne({ where: { jobId } })
    if (existing) throw new Error('Esta entrega já foi avaliada.')

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

      const count = Number(freelancer.ratingCount) + 1
      const prevAvg = Number(freelancer.ratingAvg || 0)
      const newAvg = round2((prevAvg * Number(freelancer.ratingCount) + rating) / count)
      await freelancer.update({ ratingCount: count, ratingAvg: newAvg }, { transaction: t })

      return review
    })
  },
}
