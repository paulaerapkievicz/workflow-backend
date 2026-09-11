import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { supermarketService } from '../services/supermarketService';
import { supermarketRateService } from '../services/supermarketRateService';
import { profileService } from '../services/profileService';
import { sequelize } from '../database';
import { User } from '../models/User';
import { Supermarket } from '../models/Supermarket';
import { SupermarketMember } from '../models/SupermarketMember';
import { SupermarketMemberBranch } from '../models/SupermarketMemberBranch';
import { Branch } from '../models/Branch';
import { TeamRole } from '../models/TeamRole';
import { AuthRequest } from '../middlewares/auth';
import { Transaction } from 'sequelize';
import { teamRoleService } from '../services/teamRoleService';
import { assertField } from '../helpers/validation';
import { resolveLoginEmail, emailAlreadyRegistered } from '../helpers/loginCredentials';
import { passwordResetService } from '../services/passwordResetService';

/**
 * Substitui as filiais de escopo de um gerente. `branchIds` vazio/indefinido = rede toda
 * (nenhuma linha). Valida que toda filial pertence ao supermercado.
 */
async function syncMemberBranches(
  memberId: string,
  supermarketId: string,
  branchIds: unknown,
  t: Transaction
) {
  const ids = Array.isArray(branchIds) ? [...new Set(branchIds.filter((x): x is string => !!x))] : [];
  if (ids.length) {
    const branches = await Branch.findAll({ where: { id: ids }, transaction: t });
    if (branches.length !== ids.length || branches.some((b) => b.supermarketId !== supermarketId)) {
      throw new Error('Uma ou mais filiais são inválidas para esta rede.');
    }
  }
  await SupermarketMemberBranch.destroy({ where: { supermarketMemberId: memberId }, transaction: t });
  if (ids.length) {
    await SupermarketMemberBranch.bulkCreate(
      ids.map((branchId) => ({ supermarketMemberId: memberId, branchId })),
      { transaction: t }
    );
  }
}

/** A agência só gerencia/vê os supermercados que são clientes dela. */
async function assertAgencyOwnsSupermarket(req: AuthRequest, supermarketId: string): Promise<boolean> {
  if (req.user!.role === 'admin') return true;
  const agencyId = await profileService.agencyIdForUser(req.user!);
  if (!agencyId) return false;
  const market = await Supermarket.findByPk(supermarketId);
  return !!market && market.agencyId === agencyId;
}

/** Pode gerenciar a equipe: agência (ou sócio dela) dona do supermercado OU dono do supermercado. */
async function canManageTeam(req: AuthRequest, supermarketId: string): Promise<boolean> {
  if (req.user!.role === 'agency' || req.user!.role === 'partner') return assertAgencyOwnsSupermarket(req, supermarketId);
  const ctx = await profileService.supermarketContextForUser(req.user!);
  return !!ctx && ctx.supermarketId === supermarketId && ctx.isOwner;
}

export const supermarketController = {
  // POST /agency/supermarkets — a agência cadastra um supermercado (usuário + perfil)
  async createForAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });

      const { name, address, password } = req.body ?? {};
      if (!name || !req.body?.cnpj || !address || !req.body?.email || !password) {
        return res.status(400).json({ message: 'Informe nome, CNPJ, endereço, e-mail e senha do supermercado.' });
      }
      const cnpj = assertField(req.body.cnpj, 'O CNPJ do supermercado', 'cnpj', { required: true });
      const email = assertField(req.body.email, 'O e-mail do supermercado', 'email', { required: true });
      const phone = assertField(req.body.phone, 'O telefone do supermercado', 'phone') || null;
      if (await emailAlreadyRegistered(email)) {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }

      const supermarket = await sequelize.transaction(async (t) => {
        const loginEmail = await resolveLoginEmail(agencyId, email, name);
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create(
          { name, email: loginEmail, contactEmail: email, passwordHash, role: 'supermarket', phone: phone ?? null },
          { transaction: t }
        );
        const market = await Supermarket.create(
          { ownerId: user.id, agencyId, name, cnpj, address, phone: phone ?? undefined },
          { transaction: t }
        );
        await teamRoleService.seedDefaults('supermarket', market.id, t);
        await SupermarketMember.create(
          {
            supermarketId: market.id,
            userId: user.id,
            canSubmitOrders: true,
            canApproveOrders: true,
            canViewInvoices: true,
            canPayInvoices: true,
            teamRoleId: await teamRoleService.adminRoleId('supermarket', market.id, t),
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
          { model: TeamRole, as: 'teamRole', attributes: ['id', 'name', 'position'] },
          {
            model: SupermarketMemberBranch,
            as: 'memberBranchLinks',
            attributes: ['branchId'],
            include: [{ model: Branch, as: 'branch', attributes: ['id', 'name'] }],
          },
        ],
        order: [['isOwner', 'DESC'], ['createdAt', 'ASC']],
      });
      const serialized = members.map((m) => {
        const links: any[] = (m as any).memberBranchLinks ?? [];
        return {
          ...(m as any).toJSON(),
          teamRole: teamRoleService.serialize((m as any).teamRole),
          memberBranches: links.map((l) => l.branch).filter(Boolean),
          branchIds: links.map((l) => l.branchId),
        };
      });
      return res.json(serialized);
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
      const {
        name, password, branchIds, teamRoleId,
        canSubmitOrders, canApproveOrders, canViewInvoices, canPayInvoices,
      } = req.body ?? {};
      if (!name || !req.body?.email || !password) {
        return res.status(400).json({ message: 'Informe nome, e-mail e senha do gerente.' });
      }
      const email = assertField(req.body.email, 'O e-mail do gerente', 'email', { required: true });
      if (await emailAlreadyRegistered(email)) {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }
      const market = await Supermarket.findByPk(supermarketId);
      const member = await sequelize.transaction(async (t) => {
        const loginEmail = await resolveLoginEmail(market?.agencyId ?? null, email, name);
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create(
          { name, email: loginEmail, contactEmail: email, passwordHash, role: 'supermarket', phone: null },
          { transaction: t }
        );
        const created = await SupermarketMember.create(
          {
            supermarketId,
            userId: user.id,
            canSubmitOrders: canSubmitOrders !== false,
            canApproveOrders: canApproveOrders === true,
            // Pagar exige ver.
            canViewInvoices: canViewInvoices === true || canPayInvoices === true,
            canPayInvoices: canPayInvoices === true,
            teamRoleId: await teamRoleService.resolveId(teamRoleId, 'supermarket', supermarketId, t),
            isOwner: false,
          },
          { transaction: t }
        );
        await syncMemberBranches(created.id, supermarketId, branchIds, t);
        return created;
      });
      return res.status(201).json(member);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao adicionar gerente.' });
    }
  },

  // PUT /supermarket-members/:id — permissões / filiais de escopo
  async updateMember(req: AuthRequest, res: Response) {
    try {
      const member = await SupermarketMember.findByPk(req.params.id);
      if (!member) return res.status(404).json({ message: 'Membro não encontrado.' });
      if (!(await canManageTeam(req, member.supermarketId))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      const patch: any = {};
      // O cargo (tag) pode ser trocado inclusive para o dono/administrador.
      if (req.body.teamRoleId !== undefined) {
        patch.teamRoleId = await teamRoleService.resolveId(
          req.body.teamRoleId,
          'supermarket',
          member.supermarketId
        );
      }
      if (!member.isOwner) {
        if (req.body.canSubmitOrders !== undefined) patch.canSubmitOrders = req.body.canSubmitOrders === true;
        if (req.body.canApproveOrders !== undefined) patch.canApproveOrders = req.body.canApproveOrders === true;
        if (req.body.canViewInvoices !== undefined) patch.canViewInvoices = req.body.canViewInvoices === true;
        if (req.body.canPayInvoices !== undefined) patch.canPayInvoices = req.body.canPayInvoices === true;
        // Ver e pagar andam juntos: tirar o "ver" tira o "pagar"; ligar o "pagar" liga o "ver".
        if (patch.canViewInvoices === false) patch.canPayInvoices = false;
        if (patch.canPayInvoices === true && patch.canViewInvoices === undefined) patch.canViewInvoices = true;
      } else if (
        req.body.canSubmitOrders !== undefined ||
        req.body.canApproveOrders !== undefined ||
        req.body.canViewInvoices !== undefined ||
        req.body.canPayInvoices !== undefined ||
        req.body.branchIds !== undefined
      ) {
        return res.status(400).json({ message: 'O responsável pela rede só pode ter o cargo alterado.' });
      }
      await sequelize.transaction(async (t) => {
        await member.update(patch, { transaction: t });
        if (!member.isOwner && req.body.branchIds !== undefined) {
          await syncMemberBranches(member.id, member.supermarketId, req.body.branchIds, t);
        }
      });
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

  // POST /supermarkets/:id/reset-password — a agência-cliente redefine a senha do dono do
  // supermercado pra caso ele não consiga recuperar sozinho.
  async resetOwnerPassword(req: AuthRequest, res: Response) {
    try {
      const supermarketId = req.params.id;
      if (!(await assertAgencyOwnsSupermarket(req, supermarketId))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      const market = await Supermarket.findByPk(supermarketId);
      if (!market) return res.status(404).json({ message: 'Supermercado não encontrado.' });
      const result = await passwordResetService.resetForUser(market.ownerId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao redefinir senha.' });
    }
  },

  // POST /supermarket-members/:id/reset-password — agência-cliente ou o dono do supermercado
  // redefine a senha de um gerente de loja.
  async resetMemberPassword(req: AuthRequest, res: Response) {
    try {
      const member = await SupermarketMember.findByPk(req.params.id);
      if (!member) return res.status(404).json({ message: 'Membro não encontrado.' });
      if (!(await canManageTeam(req, member.supermarketId))) {
        return res.status(403).json({ message: 'Sem permissão para gerenciar a equipe.' });
      }
      const result = await passwordResetService.resetForUser(member.userId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao redefinir senha.' });
    }
  },

  // GET /supermarkets/:id/rates — valores/hora por função que a agência cobra deste supermercado
  async listRates(req: AuthRequest, res: Response) {
    try {
      if (req.user!.role === 'supermarket') {
        const ctx = await profileService.supermarketContextForUser(req.user!);
        if (!ctx || ctx.supermarketId !== req.params.id) {
          return res.status(403).json({ message: 'Sem permissão para ver estes valores.' });
        }
      } else if ((req.user!.role === 'agency' || req.user!.role === 'partner') && !(await assertAgencyOwnsSupermarket(req, req.params.id))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      return res.json(await supermarketRateService.listForSupermarket(req.params.id));
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // POST /supermarkets/:id/rates — cria/atualiza um valor/hora (função + loja opcional)
  async saveRate(req: AuthRequest, res: Response) {
    try {
      if (!(await assertAgencyOwnsSupermarket(req, req.params.id))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      return res.status(201).json(await supermarketRateService.upsert(req.params.id, req.body));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar valor.' });
    }
  },

  // PUT /supermarkets/:id/rates/:rateId — ajusta valor/hora ou situação
  async updateRate(req: AuthRequest, res: Response) {
    try {
      if (!(await assertAgencyOwnsSupermarket(req, req.params.id))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      return res.json(await supermarketRateService.update(req.params.rateId, req.params.id, req.body));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar valor.' });
    }
  },

  // DELETE /supermarkets/:id/rates/:rateId
  async removeRate(req: AuthRequest, res: Response) {
    try {
      if (!(await assertAgencyOwnsSupermarket(req, req.params.id))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      return res.json(await supermarketRateService.remove(req.params.rateId, req.params.id));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao remover valor.' });
    }
  },

  // PUT /supermarkets/:id/app-payment — liga/desliga o pagamento da fatura pelo app pra este cliente
  async setAppPayment(req: AuthRequest, res: Response) {
    try {
      if (!(await assertAgencyOwnsSupermarket(req, req.params.id))) {
        return res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' });
      }
      const market = await Supermarket.findByPk(req.params.id);
      if (!market) return res.status(404).json({ message: 'Supermercado não encontrado.' });
      await market.update({ appPaymentEnabled: req.body?.enabled === true });
      return res.json({ id: market.id, appPaymentEnabled: market.appPaymentEnabled });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao atualizar.' });
    }
  },

  // PUT /supermarkets/:id/profile — dados cadastrais (dono do supermercado OU agência-cliente)
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageTeam(req, req.params.id))) {
        return res.status(403).json({ message: 'Sem permissão para editar este supermercado.' });
      }
      return res.json(await supermarketService.updateProfile(req.params.id, req.body ?? {}));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao salvar o perfil.' });
    }
  },

  // POST /supermarkets/:id/profile/logo | /photo (multipart campo "file")
  async uploadProfileImage(req: AuthRequest, res: Response) {
    try {
      if (!(await canManageTeam(req, req.params.id))) {
        return res.status(403).json({ message: 'Sem permissão para editar este supermercado.' });
      }
      if (!req.file) return res.status(400).json({ message: 'Envie um arquivo de imagem.' });
      const field = req.path.endsWith('/photo') ? 'profilePhotoUrl' : 'logoUrl';
      return res.json(
        await supermarketService.updateProfile(req.params.id, { [field]: `/uploads/${req.file.filename}` })
      );
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao enviar imagem.' });
    }
  },

  // PUT /supermarket/sidebar-order — só o dono da rede reordena o próprio menu
  async updateSidebarOrder(req: AuthRequest, res: Response) {
    try {
      const ctx = await profileService.supermarketContextForUser(req.user!);
      if (!ctx) return res.status(400).json({ message: 'Supermercado não encontrado.' });
      if (!ctx.isOwner) return res.status(403).json({ message: 'Só o responsável pela rede reordena o menu.' });
      const updated = await supermarketService.updateSidebarOrder(ctx.supermarketId, req.body?.sidebarOrder);
      return res.json({ sidebarOrder: updated.sidebarOrder ?? null });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro.' });
    }
  },

  // GET /supermarkets - Lista os supermercados (agência/líder: só os clientes da própria agência; admin: todos)
  async index(req: AuthRequest, res: Response) {
    try {
      let agencyId: string | undefined;
      if (req.user!.role === 'agency' || req.user!.role === 'leader' || req.user!.role === 'partner') {
        const id = await profileService.agencyIdForUser(req.user!);
        if (!id) return res.json([]);
        agencyId = id;
      }
      const supermarkets = await supermarketService.findAll(agencyId);
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
