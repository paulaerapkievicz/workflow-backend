import { Request, Response } from 'express';
import { commissionService } from '../services/commissionService';

export const commissionController = {
  // 📌 POST /commissions → Cria uma nova comissão
  async create(req: Request, res: Response) {
    try {
      const commission = await commissionService.create(req.body);
      return res.status(201).json(commission);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /commissions → Lista todas as comissões
  async getAll(req: Request, res: Response) {
    try {
      const commissions = await commissionService.getAll();
      return res.json(commissions);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /commissions/:id → Obtém detalhes de uma comissão específica
  async getById(req: Request, res: Response) {
    try {
      const commission = await commissionService.getById(req.params.id);
      if (!commission) return res.status(404).json({ message: 'Comissão não encontrada.' });
      return res.json(commission);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // ✏️ PUT /commissions/:id → Atualiza uma comissão
  async update(req: Request, res: Response) {
    try {
      const updated = await commissionService.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Comissão não encontrada.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // ❌ DELETE /commissions/:id → Remove uma comissão
  async delete(req: Request, res: Response) {
    try {
      const deleted = await commissionService.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Comissão não encontrada.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },
};
