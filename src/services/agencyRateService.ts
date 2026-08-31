import { AgencyCategoryRate } from '../models/AgencyCategoryRate'
import { Category } from '../models/Category'

const includes = [{ model: Category, as: 'rateCategory' }]

export const agencyRateService = {
  async listForAgency(agencyId: string) {
    return AgencyCategoryRate.findAll({
      where: { agencyId },
      include: includes,
      order: [['createdAt', 'ASC']],
    })
  },

  /** Valor/hora ativo de uma agência para uma categoria (ou null). */
  async activeRate(agencyId: string, categoryId: string) {
    return AgencyCategoryRate.findOne({ where: { agencyId, categoryId, active: true } })
  },

  async upsert(agencyId: string, data: { categoryId: string; hourlyRate: number; active?: boolean }) {
    if (!data.categoryId) throw new Error('Informe a categoria.')
    if (!(Number(data.hourlyRate) > 0)) throw new Error('Informe um valor/hora válido.')
    const category = await Category.findByPk(data.categoryId)
    if (!category) throw new Error('Categoria inválida.')

    const existing = await AgencyCategoryRate.findOne({ where: { agencyId, categoryId: data.categoryId } })
    if (existing) {
      await existing.update({
        hourlyRate: Number(data.hourlyRate),
        active: data.active ?? existing.active,
      })
      return AgencyCategoryRate.findByPk(existing.id, { include: includes })
    }
    const created = await AgencyCategoryRate.create({
      agencyId,
      categoryId: data.categoryId,
      hourlyRate: Number(data.hourlyRate),
      active: data.active ?? true,
    })
    return AgencyCategoryRate.findByPk(created.id, { include: includes })
  },

  async update(id: string, agencyId: string, data: { hourlyRate?: number; active?: boolean }) {
    const rate = await AgencyCategoryRate.findByPk(id)
    if (!rate || rate.agencyId !== agencyId) throw new Error('Valor/hora não encontrado.')
    const patch: any = {}
    if (data.hourlyRate != null) {
      if (!(Number(data.hourlyRate) > 0)) throw new Error('Informe um valor/hora válido.')
      patch.hourlyRate = Number(data.hourlyRate)
    }
    if (data.active != null) patch.active = data.active === true
    await rate.update(patch)
    return AgencyCategoryRate.findByPk(id, { include: includes })
  },

  async remove(id: string, agencyId: string) {
    const rate = await AgencyCategoryRate.findByPk(id)
    if (!rate || rate.agencyId !== agencyId) throw new Error('Valor/hora não encontrado.')
    await rate.destroy()
    return { message: 'Valor/hora removido.' }
  },
}
