// src/controllers/jobLogsController.ts

import { Request, Response } from 'express';
import { jobLogService } from '../services/jobLogService';

export const jobLogsController = {
  // GET /logs - Lista todos os logs
  async findAll(req: Request, res: Response) {
    try {
      const logs = await jobLogService.findAll(); // Buscando todos os logs
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /jobs/:id/logs - Lista todos os logs de um trabalho
  async index(req: Request, res: Response) {
    try {
      const logs = await jobLogService.findByJob(req.params.id);
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /freelancers/:id/logs - Lista todos os logs de um freelancer
  async findByFreelancer(req: Request, res: Response) {
    try {
      const logs = await jobLogService.findByFreelancer(req.params.id); // Buscando logs por freelancerId
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /job_logs/status - Lista os logs filtrados por status
  async findByStatus(req: Request, res: Response) {
    try {
      const { status } = req.query; // status será passado como query parameter
      const logs = await jobLogService.findByStatus(status as string);
      return res.json(logs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // POST /jobs/:id/logs/checkin - Registra o check-in de um freelancer
  async checkIn(req: Request, res: Response) {
    try {
      const log = await jobLogService.checkIn(req.params.id, req.body.freelancerId);
      return res.status(201).json(log);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  },

  // POST /jobs/:id/logs/interval - Registra início ou fim de intervalo
  async registerInterval(req: Request, res: Response) {
    try {
      const { freelancerId, eventType } = req.body;
  
      if (!['break-start', 'break-end'].includes(eventType)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }
  
      const log = await jobLogService.registerInterval(req.params.id, freelancerId, eventType);
      return res.status(201).json(log);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  },
  
  // POST /jobs/:id/logs/checkout - Registra o check-out de um freelancer
  async checkOut(req: Request, res: Response) {
    try {
      const log = await jobLogService.checkOut(req.params.id, req.body.freelancerId);
      return res.status(201).json(log);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
};
