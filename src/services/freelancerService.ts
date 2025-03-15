import { Freelancer } from '../models/Freelancer';
import { FreelancerCategory } from '../models/FreelancerCategory';
import { Category } from '../models/Category';

export const freelancerService = {
  async createFreelancer(data: any) {
    return await Freelancer.create(data);
  },

  async getAllFreelancers() {
    try {
      const freelancers = await Freelancer.findAll();
      console.log("Freelancers encontrados:", freelancers); // Verifique o que está sendo retornado
      return freelancers;
    } catch (err) {
      console.error("Erro ao buscar freelancers:", err);
      throw err;
    }
  },
  
  async getFreelancerById(id: string) {
    return await Freelancer.findByPk(id);
  },

  async updateFreelancer(id: string, data: any) {
    const freelancer = await Freelancer.findByPk(id);
    if (!freelancer) return null;

    return await freelancer.update(data);
  },

  async deleteFreelancer(id: string) {
    const deleted = await Freelancer.destroy({ where: { id } });
    return deleted > 0;
  },

  async getFreelancerCategories(freelancerId: string) {
    return await FreelancerCategory.findAll({
      where: { freelancerId },
      include: [{ model: Category, as: 'category' }],
    });
  },

  async addCategoryToFreelancer(freelancerId: string, categoryId: string) {
    return await FreelancerCategory.create({ freelancerId, categoryId });
  },

  async removeCategoryFromFreelancer(freelancerId: string, categoryId: string) {
    const deleted = await FreelancerCategory.destroy({
      where: { freelancerId, categoryId },
    });
    return deleted > 0;
  },
};
