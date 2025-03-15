import { Review } from '../models';

interface CreateReviewData {
  job_id: string;
  supermarket_id: string;
  freelancer_id: string;
  rating: number;
  comment?: string;
}

export const reviewService = {
  // 📌 Cria uma nova avaliação
  async create(data: CreateReviewData) {
    return await Review.create(data);
  },

  // 🔍 Lista todas as avaliações
  async getAll() {
    return await Review.findAll();
  },

  // 🔍 Obtém todas as avaliações de um freelancer específico
  async getByFreelancerId(freelancer_id: string) {
    return await Review.findAll({ where: { freelancer_id } });
  },

  // ❌ Remove uma avaliação específica
  async delete(id: string) {
    const deletedRows = await Review.destroy({ where: { id } });
    return deletedRows > 0;
  },
};
