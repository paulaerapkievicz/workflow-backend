import { Payment, PaymentCreationAttributes } from '../models/Payment';
import { Job } from '../models/Job';
import { Freelancer } from '../models/Freelancer';

export const paymentService = {
  /**
   * Busca todos os pagamentos, incluindo freelancer e job relacionados.
   */
  async findAll() {
    return await Payment.findAll({
      include: [
        { model: Job, as: 'paymentJob' },
        { model: Freelancer, as: 'paymentFreelancer' }
      ]
    });
  },

  /**
   * Busca um pagamento específico por ID.
   * @param id UUID do pagamento.
   */
  async findById(id: string) {
    return await Payment.findByPk(id, {
      include: [
        { model: Job, as: 'paymentJob' },
        { model: Freelancer, as: 'paymentFreelancer' }
      ]
    });
  },

  /**
   * Cria um novo pagamento.
   * @param data Dados do pagamento.
   */
  async create(data: PaymentCreationAttributes) {
    const jobExists = await Job.findByPk(data.jobId);
    if (!jobExists) throw new Error('Job não encontrado.');

    const freelancerExists = await Freelancer.findByPk(data.freelancerId);
    if (!freelancerExists) throw new Error('Freelancer não encontrado.');

    return await Payment.create(data);
  },

  /**
   * Cancela um pagamento, alterando seu status para 'canceled'.
   * @param id UUID do pagamento.
   */
  async cancel(id: string) {
    const payment = await Payment.findByPk(id);
    if (!payment) throw new Error('Pagamento não encontrado.');

    if (payment.status === 'canceled') {
      throw new Error('O pagamento já está cancelado.');
    }

    payment.status = 'canceled';
    await payment.save();
    return payment;
  }
};
