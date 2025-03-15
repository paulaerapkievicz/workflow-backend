import { Payment } from '../models';

interface CreatePaymentData {
  freelancer_id: string;
  job_id: string;
  amount: number;
  status: 'pending' | 'paid' | 'canceled';
  payment_date?: Date;
}

export const paymentService = {
  // 📌 Cria um novo pagamento
  async create(data: CreatePaymentData) {
    return await Payment.create(data);
  },

  // 🔍 Lista todos os pagamentos
  async getAll() {
    return await Payment.findAll();
  },

  // 🔍 Obtém detalhes de um pagamento específico
  async getById(id: string) {
    return await Payment.findByPk(id);
  },

  // ✏️ Atualiza um pagamento
  async update(id: string, data: Partial<CreatePaymentData>) {
    const [updatedRows] = await Payment.update(data, { where: { id }, returning: true });
    return updatedRows > 0;
  },

  // ❌ Remove um pagamento
  async delete(id: string) {
    const deletedRows = await Payment.destroy({ where: { id } });
    return deletedRows > 0;
  },
};
