import { Op } from 'sequelize'
import { SupermarketCategoryRate } from '../models/SupermarketCategoryRate'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'

const includes = [
  { model: Category, as: 'rateCategory' },
  { model: Branch, as: 'rateBranch' },
]

export const supermarketRateService = {
  async listForSupermarket(supermarketId: string) {
    return SupermarketCategoryRate.findAll({
      where: { supermarketId },
      include: includes,
      order: [['createdAt', 'ASC']],
    })
  },

  /**
   * Valor/hora ativo que a agência cobra de um supermercado para uma função numa filial.
   * Procura primeiro o valor específico da filial; se não houver, usa o padrão da rede
   * (branchId = null). Sem `branchId`, considera só o padrão.
   */
  async activeRate(supermarketId: string, categoryId: string, branchId?: string | null) {
    if (branchId) {
      const specific = await SupermarketCategoryRate.findOne({
        where: { supermarketId, categoryId, branchId, active: true },
      })
      if (specific) return specific
    }
    return SupermarketCategoryRate.findOne({
      where: { supermarketId, categoryId, branchId: null, active: true },
    })
  },

  async upsert(
    supermarketId: string,
    data: { categoryId: string; branchId?: string | null; hourlyRate: number; active?: boolean }
  ) {
    if (!data.categoryId) throw new Error('Informe a função.')
    if (!(Number(data.hourlyRate) > 0)) throw new Error('Informe um valor/hora válido.')
    const category = await Category.findByPk(data.categoryId)
    if (!category) throw new Error('Função inválida.')
    const branchId = data.branchId || null
    if (branchId) {
      const branch = await Branch.findByPk(branchId)
      if (!branch || branch.supermarketId !== supermarketId) throw new Error('Filial inválida para este supermercado.')
    }

    const existing = await SupermarketCategoryRate.findOne({
      where: { supermarketId, categoryId: data.categoryId, branchId: branchId ?? { [Op.is]: null } },
    })
    if (existing) {
      await existing.update({
        hourlyRate: Number(data.hourlyRate),
        active: data.active ?? existing.active,
      })
      return SupermarketCategoryRate.findByPk(existing.id, { include: includes })
    }
    const created = await SupermarketCategoryRate.create({
      supermarketId,
      categoryId: data.categoryId,
      branchId,
      hourlyRate: Number(data.hourlyRate),
      active: data.active ?? true,
    })
    return SupermarketCategoryRate.findByPk(created.id, { include: includes })
  },

  async update(id: string, supermarketId: string, data: { hourlyRate?: number; active?: boolean }) {
    const rate = await SupermarketCategoryRate.findByPk(id)
    if (!rate || rate.supermarketId !== supermarketId) throw new Error('Valor/hora não encontrado.')
    const patch: any = {}
    if (data.hourlyRate != null) {
      if (!(Number(data.hourlyRate) > 0)) throw new Error('Informe um valor/hora válido.')
      patch.hourlyRate = Number(data.hourlyRate)
    }
    if (data.active != null) patch.active = data.active === true
    await rate.update(patch)
    return SupermarketCategoryRate.findByPk(id, { include: includes })
  },

  async remove(id: string, supermarketId: string) {
    const rate = await SupermarketCategoryRate.findByPk(id)
    if (!rate || rate.supermarketId !== supermarketId) throw new Error('Valor/hora não encontrado.')
    await rate.destroy()
    return { message: 'Valor/hora removido.' }
  },
}
