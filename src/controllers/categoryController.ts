import { Request, Response } from 'express';
import { categoryService } from '../services/categoryService';

const fail = (res: Response, err: unknown, fallback: string) =>
  res.status(400).json({ message: err instanceof Error ? err.message : fallback });

export const categoryController = {
  async create(req: Request, res: Response) {
    try {
      const category = await categoryService.createCategory(req.body);
      return res.status(201).json(category);
    } catch (err) {
      return fail(res, err, 'Erro ao criar função.');
    }
  },

  /** Público — só funções ativas (usado nas combos de cadastro/pedido). */
  async index(_req: Request, res: Response) {
    try {
      return res.json(await categoryService.getAllCategories());
    } catch (err) {
      return fail(res, err, 'Erro ao listar funções.');
    }
  },

  /** Agência/admin — lista completa, com a flag `active`, para a tela de gestão. */
  async manageIndex(_req: Request, res: Response) {
    try {
      return res.json(await categoryService.getAllCategories({ includeInactive: true }));
    } catch (err) {
      return fail(res, err, 'Erro ao listar funções.');
    }
  },

  async show(req: Request, res: Response) {
    try {
      const category = await categoryService.getCategoryById(req.params.id);
      if (!category) return res.status(404).json({ message: 'Função não encontrada.' });
      return res.json(category);
    } catch (err) {
      return fail(res, err, 'Erro ao buscar função.');
    }
  },

  async update(req: Request, res: Response) {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      return res.json(category);
    } catch (err) {
      return fail(res, err, 'Erro ao atualizar função.');
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await categoryService.deleteCategory(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Função não encontrada.' });
      return res.json({ message: 'Função excluída.' });
    } catch (err) {
      return fail(res, err, 'Erro ao excluir função.');
    }
  },
};
