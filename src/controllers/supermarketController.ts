import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { supermarketService } from '../services/supermarketService';
import { profileService } from '../services/profileService';
import { sequelize } from '../database';
import { User } from '../models/User';
import { Supermarket } from '../models/Supermarket';
import { SupermarketMember } from '../models/SupermarketMember';
import { Branch } from '../models/Branch';
import { AuthRequest } from '../middlewares/auth';

/** Pode gerenciar a equipe: agência OU dono do supermercado. */
async function canManageTeam(req: AuthRequest, supermarketId: string): Promise<boolean> {
  if (req.user!.role === 'agency') return true;
  const ctx = await profileService.supermarketContextForUser(req.user!);
  return !!ctx && ctx.supermarketId === supermarketId && ctx.isOwner;
}

export const supermarketController = {
  // POST /agency/supermarkets — a agência cadastra um supermercado (usuário + perfil)
  async createForAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });

      const { name, cnpj, address, phone, email, password } = req.body ?? {};
      if (!name || !cnpj || !address || !email || !password) {
        return res.status(400).json({ message: 'Informe nome, CNPJ, endereço, e-mail e senha do supermercado.' });
      }
      const exists = await User.findOne({ where: { email } });
      if (exists) return res.status(409).json({ message: 'E-mail já cadastrado.' });

      const supermarket = await sequelize.transaction(async (t) => {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create(
          { name, email, passwordHash, role: 'supermarket', phone: phone ?? null },
          { transaction: t }
        );
        const market = await Supermarket.create(
          { ownerId: user.id, name, cnpj, address, phone: phone ?? undefined },
          { transaction: t }
        );
        await SupermarketMember.create(
          {
            supermarketId: market.id,
            userId: user.id,
            branchId: null,
            canSubmitOrders: true,
            canApproveOrders: true,
            isOwner: true,
          },
          { transaction: t }
        );
        return market;
      });

      return res.status(201).json(supermarket);
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'SequelizeUniqueConstraintError'
          ? 'Já existe um supermercado com esse CNPJ.'
          : error instanceof Error
          ? error.message
          : 'Erro ao cadastrar supermercado.';
      return res.status(400).json({ message });
    }
  },

  // GET /supermarkets/:id/members — equipe da rede (dono + gerentes de loja)
  async listMembers(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageTeam(req, req.params.id))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      const members = await SupermarketMember.findAll({
        where: { supermarketId: req.params.id },
        include: [
          { model: User, as: 'memberUser', attributes: ['id', 'name', 'email'] },
          { model: Branch, as: 'memberBranch', attributes: ['id', 'name'] },
        ],
        order: [['isOwner', 'DESC'], ['createdAt', 'ASC']],
      });
      return res.json(members);
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // POST /supermarkets/:id/members — cria login de gerente + vínculo
  async addMember(req: AuthRequest, res: Response) {
    try {
      const supermarketId = req.params.id;
      if (!(await canManageTeam(req, supermarketId))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      const { name, email, password, branchId, canSubmitOrders, canApproveOrders } = req.body ?? {};
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Informe nome, e-mail e senha do gerente.' });
      }
      if (await User.findOne({ where: { email } })) {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }
      if (branchId) {
        const branch = await Branch.findByPk(branchId);
        if (!branch || branch.supermarketId !== supermarketId) {
          return res.status(400).json({ message: 'Filial inválida para esta rede.' });
        }
      }
      const member = await sequelize.transaction(async (t) => {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create(
          { name, email, passwordHash, role: 'supermarket', phone: null },
          { transaction: t }
        );
        return SupermarketMember.create(
          {
            supermarketId,
            userId: user.id,
            branchId: branchId ?? null,
            canSubmitOrders: canSubmitOrders !== false,
            canApproveOrders: canApproveOrders === true,
            isOwner: false,
          },
          { transaction: t }
        );
      });
      return res.status(201).json(member);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao adicionar gerente.' });
    }
  },

  // PUT /supermarket-members/:id — permissões / filial
  async updateMember(req: AuthRequest, res: Response) {
    try {
      const member = await SupermarketMember.findByPk(req.params.id);
      if (!member) return res.status(404).json({ message: 'Membro não encontrado.' });
      if (!(await canManageTeam(req, member.supermarketId))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      if (member.isOwner) return res.status(400).json({ message: 'O dono não pode ser alterado.' });
      const patch: any = {};
      if (req.body.branchId !== undefined) patch.branchId = req.body.branchId || null;
      if (req.body.canSubmitOrders !== undefined) patch.canSubmitOrders = req.body.canSubmitOrders === true;
      if (req.body.canApproveOrders !== undefined) patch.canApproveOrders = req.body.canApproveOrders === true;
      await member.update(patch);
      return res.json(member);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // DELETE /supermarket-members/:id
  async deleteMember(req: AuthRequest, res: Response) {
    try {
      const member = await SupermarketMember.findByPk(req.params.id);
      if (!member) return res.status(404).json({ message: 'Membro não encontrado.' });
      if (!(await canManageTeam(req, member.supermarketId))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      if (member.isOwner) return res.status(400).json({ message: 'O dono não pode ser removido.' });
      await User.destroy({ where: { id: member.userId } }); // cascata remove o vínculo
      return res.json({ message: 'Gerente removido.' });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

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
