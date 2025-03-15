// src/controllers/jobController.ts
import { Request, Response } from 'express';
import { jobService } from '../services/jobService';

export const jobController = {
  // Criar nova vaga
  // POST /jobs - Cria uma nova vaga de trabalho
  async create(req: Request, res: Response) {
    try {
      const { supermarket_id, category_id, title, description } = req.body;
      if (!supermarket_id || !category_id || !title || !description) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
      }
      const job = await jobService.createJob(supermarket_id, category_id, title, description);
      return res.status(201).json(job);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao criar vaga' });
    }
  },

  // Atribuir vaga ao freelancer
  // PATCH /jobs/:id/assign - Atribui uma vaga a um freelancer
  async assignToFreelancer(req: Request, res: Response) {
    try {
      const { job_id, freelancer_id } = req.body;
      if (!job_id || !freelancer_id) {
        return res.status(400).json({ error: 'Job ID e Freelancer ID são obrigatórios' });
      }
      const job = await jobService.assignJobToFreelancer(job_id, freelancer_id);
      return res.status(200).json(job);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atribuir vaga ao freelancer' });
    }
  },

  // Aceitar vaga
  // PATCH /jobs/:id/accept - Freelancer aceita a vaga atribuída
  async acceptJob(req: Request, res: Response) {
    try {
      const { job_id, freelancer_id } = req.body;
      if (!job_id || !freelancer_id) {
        return res.status(400).json({ error: 'Job ID e Freelancer ID são obrigatórios' });
      }
      const job = await jobService.acceptJob(job_id, freelancer_id);
      return res.status(200).json(job);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao aceitar vaga' });
    }
  },

  // Cancelar vaga
  // DELETE /jobs/:id - Cancela uma vaga
  async cancelJob(req: Request, res: Response) {
    try {
      const { job_id } = req.body;
      const job = await jobService.cancelJob(job_id);
      return res.status(200).json(job);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao cancelar vaga' });
    }
  },

  // Editar vaga
  // PUT /jobs/:id - Edita os detalhes de uma vaga de trabalho
  async editJob(req: Request, res: Response) {
    try {
      const { job_id } = req.params;
      const { title, description, category_id } = req.body;
      if (!title || !description || !category_id) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
      }
      const job = await jobService.editJob(job_id, title, description, category_id);
      return res.status(200).json(job);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao editar vaga' });
    }
  }
};
 