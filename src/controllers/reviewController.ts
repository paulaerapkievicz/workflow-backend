import { Request, Response } from 'express';
import { reviewService } from '../services/reviewService';

export const reviewController = {
  // 📌 POST /reviews → Cria uma nova avaliação
  async create(req: Request, res: Response) {
    try {
      const review = await reviewService.create(req.body);
      return res.status(201).json(review);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /reviews → Lista todas as avaliações
  async getAll(req: Request, res: Response) {
    try {
      const reviews = await reviewService.getAll();
      return res.json(reviews);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // 🔍 GET /reviews/:freelancerId → Lista avaliações de um freelancer específico
  async getByFreelancerId(req: Request, res: Response) {
    try {
      const reviews = await reviewService.getByFreelancerId(req.params.freelancerId);
      return res.json(reviews);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },

  // ❌ DELETE /reviews/:id → Remove uma avaliação específica
  async delete(req: Request, res: Response) {
    try {
      const deleted = await reviewService.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Avaliação não encontrada.' });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({ message: err.message });
      }
    }
  },
};
