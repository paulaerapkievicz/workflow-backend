import { JobPhoto } from '../models/JobPhoto'
import { Job } from '../models/Job'

export const jobPhotoService = {
  async add(jobId: string, freelancerId: string, filename: string, caption?: string) {
    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.freelancerId !== freelancerId) throw new Error('Esta vaga não está atribuída a você.')
    if (!['accepted', 'in_progress', 'awaiting_approval'].includes(job.status)) {
      throw new Error('Não é possível anexar fotos nesta etapa da vaga.')
    }

    return JobPhoto.create({
      jobId,
      freelancerId,
      url: `/uploads/${filename}`,
      caption: caption?.trim() || null,
    })
  },

  async listByJob(jobId: string) {
    return JobPhoto.findAll({ where: { jobId }, order: [['createdAt', 'ASC']] })
  },
}
