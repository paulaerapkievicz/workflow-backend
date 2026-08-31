import { Response } from 'express'
import { closingService } from '../services/closingService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const closingController = {
  // GET /closings — agência: seus fechamentos; supermercado: fechamentos recebidos
  async index(req: AuthRequest, res: Response) {
    try {
      if (req.user!.role === 'agency') {
        const agencyId = await profileService.agencyIdForUser(req.user!)
        return res.json(agencyId ? await closingService.listForAgency(agencyId) : [])
      }
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      return res.json(supermarketId ? await closingService.listForSupermarket(supermarketId) : [])
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /closings/preview?supermarketId=&referenceMonth=YYYY-MM  (agency)
  async preview(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const { supermarketId, referenceMonth } = req.query as Record<string, string>
      if (!supermarketId || !referenceMonth) {
        return res.status(400).json({ message: 'Informe supermarketId e referenceMonth (AAAA-MM).' })
      }
      return res.json(await closingService.previewMonth(agencyId, supermarketId, referenceMonth))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /closings  { supermarketId, referenceMonth }  (agency)
  async create(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const { supermarketId, referenceMonth } = req.body
      if (!supermarketId || !referenceMonth) {
        return res.status(400).json({ message: 'Informe supermarketId e referenceMonth (AAAA-MM).' })
      }
      return res.status(201).json(await closingService.closeMonth(agencyId, supermarketId, referenceMonth))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /closings/:id
  async show(req: AuthRequest, res: Response) {
    try {
      const closing = await closingService.findById(req.params.id)
      if (!closing) return res.status(404).json({ message: 'Fechamento não encontrado.' })
      return res.json(closing)
    } catch (error) {
      return fail(res, error, 500)
    }
  },
}
