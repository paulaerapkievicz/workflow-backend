import { Request, Response } from 'express';
import { sessionService } from '../services/sessionService';

export const sessionController = {
  // 📌 POST /sessions → Cria uma nova sessão
  async create(req: Request, res: Response) {
    try {
      const session = await sessionService.create(req.body);
      return res.status(201).json(session);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /sessions/:token → Obtém uma sessão pelo token
  async getByToken(req: Request, res: Response) {
    try {
      const session = await sessionService.getByToken(req.params.token);
      if (!session) return res.status(404).json({ message: 'Sessão não encontrada.' });
      return res.json(session);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // ❌ DELETE /sessions/:token → Remove uma sessão pelo token
  async deleteByToken(req: Request, res: Response) {
    try {
      const deleted = await sessionService.deleteByToken(req.params.token);
      if (!deleted) return res.status(404).json({ message: 'Sessão não encontrada.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // ❌ DELETE /sessions/user/:user_id → Remove todas as sessões de um usuário
  async deleteByUserId(req: Request, res: Response) {
    try {
      const deleted = await sessionService.deleteByUserId(req.params.user_id);
      if (!deleted) return res.status(404).json({ message: 'Nenhuma sessão encontrada para este usuário.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },
};
