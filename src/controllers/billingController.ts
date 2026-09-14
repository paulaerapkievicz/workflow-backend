import { Response } from 'express'
import { billingService } from '../services/billingService'
import { reportService } from '../services/reportService'
import { freelancerReportPdfService } from '../services/freelancerReportPdfService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

/** Filtra os itens do relatório pelos parâmetros opcionais da querystring (mesmos filtros da tela). */
function filterReportItems(
  items: Awaited<ReturnType<typeof reportService.freelancerReport>>['items'],
  q: Record<string, unknown>
) {
  const from = q.from ? new Date(String(q.from)) : null
  const to = q.to ? new Date(String(q.to)) : null
  if (to) to.setHours(23, 59, 59, 999)
  return items.filter((i) => {
    if (q.categoryId && i.categoryId !== q.categoryId) return false
    if (q.branchId && i.branchId !== q.branchId) return false
    if (i.date) {
      const d = new Date(i.date)
      if (from && d < from) return false
      if (to && d > to) return false
    }
    return true
  })
}

export const billingController = {
  // GET /billing/summary (supermarket) — faturamento: histórico por mês/função
  async summary(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await billingService.summaryForSupermarket(supermarketId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /reports/freelancer (freelancer) — trabalhos concluídos e valores
  async freelancerReport(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(403).json({ message: 'Perfil de freelancer não encontrado.' })
      return res.json(await reportService.freelancerReport(freelancer.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /freelancer/outcomes (freelancer) — desfecho de cada vaga (aceita/ativa/concluída/
  // abandono/desistência) pros tiles do Dashboard.
  async freelancerOutcomes(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(403).json({ message: 'Perfil de freelancer não encontrado.' })
      return res.json(await reportService.freelancerOutcomes(freelancer.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /reports/freelancer/pdf (freelancer) — mesmo relatório, em PDF. Aceita
  // ?from&to&categoryId&branchId pra respeitar os filtros aplicados na tela.
  async freelancerReportPdf(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(403).json({ message: 'Perfil de freelancer não encontrado.' })
      const { items } = await reportService.freelancerReport(freelancer.id)
      const filtered = filterReportItems(items, req.query as Record<string, unknown>)
      const doc = freelancerReportPdfService.buildReportPdf(freelancer.name, filtered)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="relatorio-trabalhos.pdf"')
      doc.pipe(res)
    } catch (error) {
      return fail(res, error, 500)
    }
  },
}
