import { Response } from 'express'
import { jobPhotoService } from '../services/jobPhotoService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

export const jobPhotoController = {
  // POST /jobs/:id/photos  (multipart, campo "photo")
  async upload(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de freelancer não encontrado.' })
      if (!req.file) return res.status(400).json({ message: 'Nenhuma imagem enviada.' })

      const photo = await jobPhotoService.add(req.params.id, freelancer.id, req.file.filename, req.body.caption)
      return res.status(201).json(photo)
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao enviar foto.' })
    }
  },

  // GET /jobs/:id/photos
  async listByJob(req: AuthRequest, res: Response) {
    try {
      return res.json(await jobPhotoService.listByJob(req.params.id))
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao listar fotos.' })
    }
  },
}
