import { Request, Response } from 'express';
import { freelancerLocationService } from '../services/freelancerLocationService';

export const freelancerLocationController = {
  async trackLocation(req: Request, res: Response) {
    try {
      const { freelancer_id, job_id, latitude, longitude } = req.body;
      if (!freelancer_id || !job_id || !latitude || !longitude) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
      }
      const location = await freelancerLocationService.trackLocation(freelancer_id, job_id, latitude, longitude);
      return res.status(201).json(location);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao salvar localização' });
    }
  },

  async getLatestLocation(req: Request, res: Response) {
    try {
      const { freelancer_id } = req.query;
      if (!freelancer_id) {
        return res.status(400).json({ error: 'freelancer_id é obrigatório' });
      }
      const location = await freelancerLocationService.getLatestLocationByFreelancer(freelancer_id as string);
      return res.json(location);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar localização' });
    }
  },
};