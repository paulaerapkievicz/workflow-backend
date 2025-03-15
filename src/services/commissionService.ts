import { Commission } from '../models';

interface CreateCommissionData {
  agency_id: string;
  job_id: string;
  commission_percentage: number;
  commission_amount: number;
}

export const commissionService = {
  // 📌 Cria uma nova comissão
  async create(data: CreateCommissionData) {
    return await Commission.create(data);
  },

  // 🔍 Lista todas as comissões
  async getAll() {
    return await Commission.findAll();
  },

  // 🔍 Obtém detalhes de uma comissão específica
  async getById(id: string) {
    return await Commission.findByPk(id);
  },

  // ✏️ Atualiza uma comissão
  async update(id: string, data: Partial<CreateCommissionData>) {
    const [updatedRows] = await Commission.update(data, { where: { id }, returning: true });
    return updatedRows > 0;
  },

  // ❌ Remove uma comissão
  async delete(id: string) {
    const deletedRows = await Commission.destroy({ where: { id } });
    return deletedRows > 0;
  },
};
