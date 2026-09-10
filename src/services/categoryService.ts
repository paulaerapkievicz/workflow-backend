import { Op } from 'sequelize';
import { Category } from '../models/Category';
import { FreelancerCategory } from '../models/FreelancerCategory';
import { SupermarketCategoryRate } from '../models/SupermarketCategoryRate';
import { Job } from '../models/Job';

export const categoryService = {
  async createCategory(data: { name?: unknown }) {
    const name = String(data?.name ?? '').trim();
    if (!name) throw new Error('Informe o nome da função.');
    const clash = await Category.findOne({ where: { name } });
    if (clash) throw new Error('Já existe uma função com esse nome.');
    return await Category.create({ name });
  },

  /** `includeInactive` só para as telas de gestão (agência/admin). */
  async getAllCategories(opts: { includeInactive?: boolean } = {}) {
    const where = opts.includeInactive ? {} : { active: true };
    return await Category.findAll({ where, order: [['name', 'ASC']] });
  },

  async getCategoryById(id: string) {
    return await Category.findByPk(id);
  },

  async updateCategory(id: string, data: { name?: unknown; active?: unknown }) {
    const category = await Category.findByPk(id);
    if (!category) throw new Error('Função não encontrada.');
    const patch: { name?: string; active?: boolean } = {};
    if (data.name !== undefined) {
      const name = String(data.name ?? '').trim();
      if (!name) throw new Error('Informe o nome da função.');
      if (name !== category.name) {
        const clash = await Category.findOne({ where: { name, id: { [Op.ne]: id } } });
        if (clash) throw new Error('Já existe uma função com esse nome.');
      }
      patch.name = name;
    }
    if (data.active !== undefined) patch.active = data.active === true;
    await category.update(patch);
    return category;
  },

  async deleteCategory(id: string) {
    const category = await Category.findByPk(id);
    if (!category) return false;
    const [inFreelancers, inRates, inJobs] = await Promise.all([
      FreelancerCategory.count({ where: { categoryId: id } }),
      SupermarketCategoryRate.count({ where: { categoryId: id } }),
      Job.count({ where: { categoryId: id } }),
    ]);
    if (inFreelancers || inRates || inJobs) {
      throw new Error('Função em uso por colaboradores, valores/hora ou vagas — desative em vez de excluir.');
    }
    await category.destroy();
    return true;
  },
};
