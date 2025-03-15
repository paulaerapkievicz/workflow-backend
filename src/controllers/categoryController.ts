import { Request, Response } from 'express';
import { categoryService } from '../services/categoryService';

export const categoryController = {
  async create(req: Request, res: Response) {
    try {
      const category = await categoryService.createCategory(req.body);
      return res.status(201).json(category);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao criar categoria.' });
    }
  },

  async index(req: Request, res: Response) {
    try {
      const categories = await categoryService.getAllCategories();
      return res.json(categories);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar categorias.' });
    }
  },

  async show(req: Request, res: Response) {
    try {
      const category = await categoryService.getCategoryById(req.params.id);
      if (!category) return res.status(404).json({ message: 'Categoria não encontrada.' });

      return res.json(category);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao buscar categoria.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await categoryService.deleteCategory(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Categoria não encontrada.' });

      return res.json({ message: 'Categoria deletada com sucesso.' });
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao deletar categoria.' });
    }
  },
};
