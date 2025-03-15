import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService';
import { jobLogService } from '../services/jobLogService';

export const paymentController = {
    // Criar pagamento para um freelancer com base nos logs de trabalho
    async create(req: Request, res: Response) {
      try {
        const { freelancerId, jobId } = req.body;
  
        // Obter logs de trabalho do freelancer para o trabalho especificado
        const logs = await jobLogService.findAll(jobId);
  
        // Calcular o total de horas ou outro critério baseado nos logs
        const totalHours = logs.reduce((total, log) => {
          if (log.eventType === 'check-in' || log.eventType === 'check-out') {
            // Lógica para calcular horas trabalhadas
            return total + 1; // Exemplo simples (1 hora por log)
          }
          return total;
        }, 0);
  
        // Criar o pagamento
        const payment = await paymentService.create({
          freelancerId,
          amount: totalHours * 20, // Exemplo de cálculo de pagamento
        });
  
        return res.status(201).json(payment);
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    },
    
  // 📌 POST /payments → Cria um novo pagamento
  async create(req: Request, res: Response) {
    try {
      const payment = await paymentService.create(req.body);
      return res.status(201).json(payment);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /payments → Lista todos os pagamentos
  async getAll(req: Request, res: Response) {
    try {
      const payments = await paymentService.getAll();
      return res.json(payments);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /payments/:id → Obtém detalhes de um pagamento específico
  async getById(req: Request, res: Response) {
    try {
      const payment = await paymentService.getById(req.params.id);
      if (!payment) return res.status(404).json({ message: 'Pagamento não encontrado.' });
      return res.json(payment);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // ✏️ PUT /payments/:id → Atualiza um pagamento
  async update(req: Request, res: Response) {
    try {
      const updated = await paymentService.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Pagamento não encontrado.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // ❌ DELETE /payments/:id → Remove um pagamento
  async delete(req: Request, res: Response) {
    try {
      const deleted = await paymentService.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Pagamento não encontrado.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },
};
