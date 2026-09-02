import { Op } from 'sequelize'
import { AgencyCategoryRate } from '../models/AgencyCategoryRate'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'

const includes = [
  { model: Category, as: 'rateCategory' },
  { model: Branch, as: 'rateBranch' },
]

export const agencyRateService = {
  async listForAgency(agencyId: string) {
    return AgencyCategoryRate.findAll({
      where: { agencyId },
      include: includes,
      order: [['createdAt', 'ASC']],
    })
  },

  /**
   * Valor/hora ativo de uma agência para uma categoria numa filial.
   * Procura primeiro o valor específico da filial; se não houver, usa o padrão da rede
   * (branchId = null). Sem `branchId`, considera só o padrão.
   */
  async activeRate(agencyId: string, categoryId: string, branchId?: string | null) {
    if (branchId) {
      const specific = await AgencyCategoryRate.findOne({
        where: { agencyId, categoryId, branchId, active: true },
      })
      if (specific) return specific
    }
    return AgencyCategoryRate.findOne({ where: { agencyId, categoryId, branchId: null, active: true } })
  },

  async upsert(
    agencyId: string,
    data: { categoryId: string; branchId?: string | null; hourlyRate: number; active?: boolean }
  ) {
    if (!data.categoryId) throw new Error('Informe a categoria.')
    if (!(Number(data.hourlyRate) > 0)) throw new Error('Informe um valor/hora válido.')
    const category = await Category.findByPk(data.categoryId)
    if (!category) throw new Error('Categoria inválida.')
    const branchId = data.branchId || null
    if (branchId) {
      const branch = await Branch.findByPk(branchId)
      if (!branch) throw new Error('Filial inválida.')
    }

    const existing = await AgencyCategoryRate.findOne({
      where: { agencyId, categoryId: data.categoryId, branchId: branchId ?? { [Op.is]: null } },
    })
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
      branchId,
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
