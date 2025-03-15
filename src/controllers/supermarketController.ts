import { Request, Response } from 'express';
import { supermarketService } from '../services/supermarketService';

export const supermarketController = {
  // GET /supermarkets - Lista todos os supermercados
  async index(req: Request, res: Response) {
    try {
      const supermarkets = await supermarketService.findAll();
      return res.json(supermarkets);
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar supermercados.' });
    }
  },

  // GET /supermarkets/:id - Mostra um supermercado específico
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supermarket = await supermarketService.findById(id);
      if (!supermarket) return res.status(404).json({ message: 'Supermercado não encontrado.' });
      return res.json(supermarket);
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro ao buscar supermercado.' });
    }
  },

  // POST /supermarkets - Cria um supermercado
  async create(req: Request, res: Response) {
    try {
      const supermarket = await supermarketService.create(req.body);
      return res.status(201).json(supermarket);
    } catch (error) {
      const message = error instanceof Error && error.name === 'SequelizeUniqueConstraintError' 
        ? 'Já existe um supermercado com esse CNPJ.' 
        : 'Erro ao criar supermercado.';
      return res.status(400).json({ message });
    }
  },

  // PUT /supermarkets/:id - Atualiza um supermercado
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supermarket = await supermarketService.update(id, req.body);
      if (!supermarket) return res.status(404).json({ message: 'Supermercado não encontrado.' });
      return res.json(supermarket);
    } catch (error) {
      const message = error instanceof Error && error.name === 'SequelizeForeignKeyConstraintError' 
        ? 'O proprietário informado não existe.' 
        : 'Erro ao atualizar supermercado.';
      return res.status(400).json({ message });
    }
  },

  // DELETE /supermarkets/:id - Exclui um supermercado
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await supermarketService.delete(id);
      if (!result) return res.status(404).json({ message: 'Supermercado não encontrado.' });
      return res.json({ message: 'Supermercado excluído com sucesso.' });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao excluir supermercado.' });
    }
  }
};
