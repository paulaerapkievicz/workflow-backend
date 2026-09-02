import { Request, Response } from 'express';
import { branchService } from '../services/branchService';
import { profileService } from '../services/profileService';
import { AuthRequest } from '../middlewares/auth';

export const branchController = {
  // GET /branches - Lista todas as filiais
  async index(req: Request, res: Response) {
    try {
      const branches = await branchService.findAll();
      return res.json(branches);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar filiais.' });
    }
  },

  // GET /branches/:id - Busca uma filial pelo ID
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const branch = await branchService.findById(id);
      if (!branch) return res.status(404).json({ message: 'Filial não encontrada.' });
      return res.json(branch);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar filial.' });
    }
  },

  // POST /branches/geocode - Busca coordenadas de um endereço (prévia, não salva)
  async geocode(req: AuthRequest, res: Response) {
    try {
      const address = req.body?.address ?? req.query?.address;
      if (!address) return res.status(400).json({ message: 'Informe o endereço.' });
      return res.json(await branchService.geocode(String(address)));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao geocodificar.' });
    }
  },

  // POST /branches - Cria uma nova filial
  async create(req: AuthRequest, res: Response) {
    try {
      let supermarketId = req.body.supermarketId;
      if (req.user && req.user.role === 'supermarket') {
        supermarketId = await profileService.supermarketIdForUser(req.user);
        if (!supermarketId) {
          return res.status(400).json({ message: 'Cadastre o supermercado antes de criar filiais.' });
        }
      }
      const branch = await branchService.create({ ...req.body, supermarketId });
      return res.status(201).json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar filial.' });
    }
  },

  // PUT /branches/:id - Atualiza uma filial pelo ID
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const branch = await branchService.update(id, req.body);
      return res.json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar filial.' });
    }
  },

  // DELETE /branches/:id - Exclui uma filial pelo ID
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await branchService.delete(id);
      return res.json({ message: 'Filial excluída com sucesso.' });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao excluir filial.' });
    }
  }
};
