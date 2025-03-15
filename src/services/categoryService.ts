import { Category } from '../models/Category';

export const categoryService = {
  async createCategory(data: any) {
    return await Category.create(data);
  },

  async getAllCategories() {
    return await Category.findAll();
  },

  async getCategoryById(id: string) {
    return await Category.findByPk(id);
  },

  async deleteCategory(id: string) {
    const deleted = await Category.destroy({ where: { id } });
    return deleted > 0;
  },
};
