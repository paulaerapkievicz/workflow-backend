import { Request, Response } from 'express';
import { agencyService } from '../services/agencyService';
import { profileService } from '../services/profileService';
import { AuthRequest } from '../middlewares/auth';

export const agencyController = {
  // GET /agency/settings (agency) — configurações operacionais da minha agência
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(400).json({ message: 'Cadastre a agência primeiro.' });
      return res.json(await agencyService.getSettings(agencyId));
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // PUT /agency/settings (agency)
  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(400).json({ message: 'Cadastre a agência primeiro.' });
      return res.json(await agencyService.updateSettings(agencyId, req.body ?? {}));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // GET /agencies - Lista todas as agências
  async index(req: Request, res: Response) {
    try {
      const agencies = await agencyService.findAll();
      return res.json(agencies);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar agências.' });
    }
  },

  // GET /agencies/:id - Busca uma agência pelo ID
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const agency = await agencyService.findById(id);
      if (!agency) return res.status(404).json({ message: 'Agência não encontrada.' });

      return res.json(agency);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar agência.' });
    }
  },

  // POST /agencies - Cria uma nova agência
  async create(req: Request, res: Response) {
    try {
      const agency = await agencyService.create(req.body);
      return res.status(201).json(agency);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar agência.' });
    }
  },

  // PUT /agencies/:id - Atualiza uma agência pelo ID
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const agency = await agencyService.update(id, req.body);
      if (!agency) return res.status(404).json({ message: 'Agência não encontrada.' });

      return res.json(agency);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar agência.' });
    }
  },

  // DELETE /agencies/:id - Exclui uma agência pelo ID
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await agencyService.delete(id);
      if (!deleted) return res.status(404).json({ message: 'Agência não encontrada.' });

      return res.json({ message: 'Agência excluída com sucesso.' });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao excluir agência.' });
    }
  }
};
