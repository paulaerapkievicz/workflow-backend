// src/controllers/jobController.ts

import { Request, Response } from 'express';
import { jobService } from '../services/jobService';

export const jobController = {
  // POST /jobs - Cria um nova vaga
  async create(req: Request, res: Response) {
    try {
      const job = await jobService.create(req.body);
      return res.status(201).json(job);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  },

  // GET /jobs - Lista todos os trabalhos
  async index(req: Request, res: Response) {
    try {
      const jobs = await jobService.findAll();
      return res.json(jobs);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /jobs/:id - Busca um trabalho pelo ID
  async show(req: Request, res: Response) {
    try {
      const job = await jobService.findById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Trabalho não encontrado.' });

      return res.json(job);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // PUT /jobs/:id - Atualiza um trabalho pelo ID
  async update(req: Request, res: Response) {
    try {
      const updatedJob = await jobService.update(req.params.id, req.body);
      return res.json(updatedJob);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  },

  // DELETE /jobs/:id - Remove um trabalho pelo ID
  async delete(req: Request, res: Response) {
    try {
      const message = await jobService.delete(req.params.id);
      return res.status(200).json(message);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
};
