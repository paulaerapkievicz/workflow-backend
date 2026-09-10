// src/services/contractTemplateService.ts

import { sequelize } from '../database'
import { ContractTemplate } from '../models/ContractTemplate'
import { sanitizeContractHtml } from '../helpers/contractDocument'

export const contractTemplateService = {
  listForAgency(agencyId: string) {
    return ContractTemplate.findAll({ where: { agencyId }, order: [['updatedAt', 'DESC']] })
  },

  async getForAgency(id: string, agencyId: string) {
    const tpl = await ContractTemplate.findByPk(id)
    if (!tpl || tpl.agencyId !== agencyId) throw new Error('Modelo de contrato não encontrado.')
    return tpl
  },

  activeForAgency(agencyId: string) {
    return ContractTemplate.findOne({ where: { agencyId, active: true } })
  },

  async create(agencyId: string, data: { title?: string; bodyHtml?: string }, createdBy?: string) {
    const title = String(data.title ?? '').trim()
    if (!title) throw new Error('Dê um nome ao modelo de contrato.')
    const bodyHtml = sanitizeContractHtml(String(data.bodyHtml ?? ''))
    const hasFirst = (await ContractTemplate.count({ where: { agencyId } })) === 0
    return ContractTemplate.create({ agencyId, title, bodyHtml, active: hasFirst, createdBy: createdBy ?? null })
  },

  async update(id: string, agencyId: string, data: { title?: string; bodyHtml?: string }) {
    const tpl = await this.getForAgency(id, agencyId)
    const patch: Record<string, unknown> = {}
    if (data.title !== undefined) {
      const title = String(data.title).trim()
      if (!title) throw new Error('Dê um nome ao modelo de contrato.')
      patch.title = title
    }
    if (data.bodyHtml !== undefined) patch.bodyHtml = sanitizeContractHtml(String(data.bodyHtml))
    await tpl.update(patch)
    return tpl.reload()
  },

  /** Marca este modelo como ativo e desmarca os demais da agência (um ativo por vez). */
  async setActive(id: string, agencyId: string) {
    const tpl = await this.getForAgency(id, agencyId)
    await sequelize.transaction(async (t) => {
      await ContractTemplate.update({ active: false }, { where: { agencyId }, transaction: t })
      await tpl.update({ active: true }, { transaction: t })
    })
    return tpl.reload()
  },

  async remove(id: string, agencyId: string) {
    const tpl = await this.getForAgency(id, agencyId)
    await tpl.destroy()
    return { message: 'Modelo removido.' }
  },
}
