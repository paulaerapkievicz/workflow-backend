import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService';

export const paymentController = {
  /**
   * Lista todos os pagamentos.
   */
  async index(req: Request, res: Response) {
    try {
      const payments = await paymentService.findAll();
      return res.json(payments);
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar pagamentos.' });
    }
  },

  /**
   * Retorna um pagamento específico pelo ID.
   */
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payment = await paymentService.findById(id);
      if (!payment) return res.status(404).json({ message: 'Pagamento não encontrado.' });
      return res.json(payment);
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar pagamento.' });
    }
  },

  /**
   * Cria um novo pagamento.
   */
  async create(req: Request, res: Response) {
    try {
      const payment = await paymentService.create(req.body);
      return res.status(201).json(payment);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar pagamento.' });
    }
  },

  /**
   * Cancela um pagamento alterando seu status.
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payment = await paymentService.cancel(id);
      return res.json(payment);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao cancelar pagamento.' });
    }
  }
};
