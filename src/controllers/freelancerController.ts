import { Request, Response } from 'express';
import { freelancerService } from '../services/freelancerService';

export const freelancerController = {
  async create(req: Request, res: Response) {
    try {
      const freelancer = await freelancerService.createFreelancer(req.body);
      return res.status(201).json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao criar freelancer.' });
    }
  },

  async index(req: Request, res: Response) {
    try {
      const freelancers = await freelancerService.getAllFreelancers();
      return res.json(freelancers);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar freelancers.' });
    }
  },

  async show(req: Request, res: Response) {
    try {
      const freelancer = await freelancerService.getFreelancerById(req.params.id);
      if (!freelancer) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      return res.json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao buscar freelancer.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const updatedFreelancer = await freelancerService.updateFreelancer(req.params.id, req.body);
      if (!updatedFreelancer) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      return res.json(updatedFreelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao atualizar freelancer.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await freelancerService.deleteFreelancer(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      return res.json({ message: 'Freelancer deletado com sucesso.' });
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao deletar freelancer.' });
    }
  },

  async listCategories(req: Request, res: Response) {
    try {
      const categories = await freelancerService.getFreelancerCategories(req.params.id);
      return res.json(categories);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar categorias do freelancer.' });
    }
  },

  async addCategory(req: Request, res: Response) {
    try {
      const result = await freelancerService.addCategoryToFreelancer(req.params.id, req.body.categoryId);
      return res.status(201).json(result);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao adicionar categoria ao freelancer.' });
    }
  },

  async removeCategory(req: Request, res: Response) {
    try {
      const removed = await freelancerService.removeCategoryFromFreelancer(req.params.id, req.params.category_id);
      if (!removed) return res.status(404).json({ message: 'Relação freelancer-categoria não encontrada.' });

      return res.json({ message: 'Categoria removida do freelancer.' });
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao remover categoria do freelancer.' });
    }
  },
};
