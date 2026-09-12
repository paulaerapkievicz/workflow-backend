import { Response } from 'express';
import { branchService } from '../services/branchService';
import { profileService } from '../services/profileService';
import { Supermarket } from '../models/Supermarket';
import { Branch } from '../models/Branch';
import { AuthRequest } from '../middlewares/auth';

/** Pode editar a filial: admin, dono do supermercado ou a agência-cliente dele. */
async function canManageBranch(req: AuthRequest, branchId: string): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const branch = await Branch.findByPk(branchId);
  if (!branch) return false;
  if (req.user!.role === 'agency' || req.user!.role === 'partner') {
    const agencyId = await profileService.agencyIdForUser(req.user!);
    const market = await Supermarket.findByPk(branch.supermarketId);
    return !!agencyId && !!market && market.agencyId === agencyId;
  }
  if (req.user!.role === 'leader') {
    const actor = await profileService.agencyContextForUser(req.user!);
    const market = await Supermarket.findByPk(branch.supermarketId);
    if (!actor || !market || market.agencyId !== actor.agencyId) return false;
    return !actor.scopeBranchIds || actor.scopeBranchIds.includes(branchId);
  }
  const ctx = await profileService.supermarketContextForUser(req.user!);
  return !!ctx && ctx.supermarketId === branch.supermarketId && ctx.isOwner;
}

/** Pode ler a filial: admin, agência-cliente (rede/escopo) ou qualquer membro do supermercado. */
async function canReadBranch(req: AuthRequest, branchId: string): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const branch = await Branch.findByPk(branchId);
  if (!branch) return false;
  if (req.user!.role === 'agency' || req.user!.role === 'leader' || req.user!.role === 'partner') {
    const actor = await profileService.agencyContextForUser(req.user!);
    const market = await Supermarket.findByPk(branch.supermarketId);
    if (!actor || !market || market.agencyId !== actor.agencyId) return false;
    return !actor.scopeBranchIds || actor.scopeBranchIds.includes(branchId);
  }
  if (req.user!.role === 'supermarket') {
    const supermarketId = await profileService.supermarketIdForUser(req.user!);
    return !!supermarketId && supermarketId === branch.supermarketId;
  }
  return false;
}

export const branchController = {
  // GET /branches - Lista as filiais visíveis ao usuário logado (rede/escopo dele)
  async index(req: AuthRequest, res: Response) {
    try {
      const branches = await branchService.findAllForUser(req.user!);
      return res.json(branches);
    } catch (error) {
      return res.status(500).json({ message: 'Erro ao buscar filiais.' });
    }
  },

  // GET /branches/:id - Busca uma filial pelo ID (só quem tem acesso a ela)
  async show(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!(await canReadBranch(req, id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
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
      // Filial cadastrada pelo próprio supermercado nasce pendente até a agência aprovar
      // o atendimento; cadastrada pela agência (ou admin) já nasce liberada.
      let serviceStatus: 'approved' | 'pending' = 'approved';

      if (req.user && req.user.role === 'supermarket') {
        supermarketId = await profileService.supermarketIdForUser(req.user);
        if (!supermarketId) {
          return res.status(400).json({ message: 'Cadastre o supermercado antes de criar filiais.' });
        }
        serviceStatus = 'pending';
      } else if (req.user && (req.user.role === 'agency' || req.user.role === 'partner')) {
        const agencyId = await profileService.agencyIdForUser(req.user);
        const market = await Supermarket.findByPk(supermarketId);
        if (!agencyId || !market || market.agencyId !== agencyId) {
          return res.status(404).json({ message: 'Supermercado não encontrado.' });
        }
      }
      const branch = await branchService.create({ ...req.body, supermarketId, serviceStatus });
      return res.status(201).json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao criar filial.' });
    }
  },

  // POST /branches/:id/approve — agência aprova o atendimento de uma filial cadastrada pelo supermercado
  async approve(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });
      const branch = await branchService.approveForAgency(req.params.id, agencyId, req.user!.id);
      return res.json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao aprovar filial.' });
    }
  },

  // PUT /branches/:id - Atualiza uma filial pelo ID
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!(await canManageBranch(req, id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
      const branch = await branchService.update(id, req.body);
      return res.json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar filial.' });
    }
  },

  // GET /branches/:id/profile — perfil efetivo (com herança da matriz)
  async resolvedProfile(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageBranch(req, req.params.id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
      const { branch, profile } = await branchService.resolvedProfile(req.params.id);
      return res.json({ branch, profile });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao buscar filial.' });
    }
  },

  // PUT /branches/:id/profile — dados cadastrais próprios da filial
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageBranch(req, req.params.id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
      const branch = await branchService.updateProfile(req.params.id, req.body ?? {});
      return res.json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar a filial.' });
    }
  },

  // POST /branches/:id/profile/logo | /photo (multipart campo "file")
  async uploadProfileImage(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageBranch(req, req.params.id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
      if (!req.file) return res.status(400).json({ message: 'Envie um arquivo de imagem.' });
      const field = req.path.endsWith('/photo') ? 'profilePhotoUrl' : 'logoUrl';
      const branch = await branchService.updateProfile(req.params.id, { [field]: `/uploads/${req.file.filename}` });
      return res.json(branch);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao enviar imagem.' });
    }
  },

  // DELETE /branches/:id - Exclui uma filial pelo ID
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!(await canManageBranch(req, id))) {
        return res.status(404).json({ message: 'Filial não encontrada.' });
      }
      await branchService.delete(id);
      return res.json({ message: 'Filial excluída com sucesso.' });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao excluir filial.' });
    }
  }
};
