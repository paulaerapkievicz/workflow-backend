import { Op } from 'sequelize';
import { sequelize } from '../database';
import { Freelancer } from '../models/Freelancer';
import { FreelancerCategory } from '../models/FreelancerCategory';
import { Category } from '../models/Category';
import { User } from '../models/User';
import { Agency } from '../models/Agency';
import { AgencyActor } from '../helpers/agencyScope';
import { assertField } from '../helpers/validation';

export const freelancerService = {
  async createFreelancer(data: any) {
    return await Freelancer.create(data);
  },

  async getAllFreelancers() {
    try {
      const freelancers = await Freelancer.findAll();
      console.log("Freelancers encontrados:", freelancers); // Verifique o que está sendo retornado
      return freelancers;
    } catch (err) {
      console.error("Erro ao buscar freelancers:", err);
      throw err;
    }
  },
  
  async getFreelancerById(id: string) {
    return await Freelancer.findByPk(id);
  },

  async getFreelancersForAgency(agencyId: string, actor?: AgencyActor | null) {
    const where: any = { agencyId };
    if (actor?.scopeFreelancerIds) where.id = { [Op.in]: actor.scopeFreelancerIds };
    return await Freelancer.findAll({ where });
  },

  async updateFreelancer(id: string, data: any, actorRole?: string) {
    const freelancer = await Freelancer.findByPk(id);
    if (!freelancer) return null;

    // Só campos de perfil — nunca agencyId / saldo / userId.
    const patch: Record<string, unknown> = {};
    for (const field of ['name', 'skills'] as const) {
      if (data[field] !== undefined) patch[field] = data[field];
    }
    if (data.email !== undefined) patch.email = assertField(data.email, 'O e-mail', 'email', { required: true });
    if (data.phone !== undefined) patch.phone = assertField(data.phone, 'O telefone', 'phone') || null;
    if (data.document !== undefined) patch.document = assertField(data.document, 'O CPF', 'cpf') || null;

    // Visibilidade de Carteira/Relatório: só agência/sócio/admin decide — nunca o próprio colaborador.
    if (actorRole && ['agency', 'partner', 'admin'].includes(actorRole)) {
      if (data.walletVisibleOverride !== undefined) patch.walletVisibleOverride = data.walletVisibleOverride;
      if (data.reportVisibleOverride !== undefined) patch.reportVisibleOverride = data.reportVisibleOverride;
    }

    return await freelancer.update(patch);
  },

  /**
   * Colaborador envia (ou reenvia) a foto de perfil no onboarding. Se a agência exige aprovação,
   * fica 'pending' até a agência revisar; senão já vale direto como foto de perfil ('approved').
   */
  async submitProfilePhoto(freelancerId: string, url: string) {
    const freelancer = await Freelancer.findByPk(freelancerId);
    if (!freelancer) throw new Error('Colaborador não encontrado.');
    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null;
    const needsApproval = !!agency?.requirePhotoApproval;
    await freelancer.update({
      profilePhotoUrl: url,
      profilePhotoStatus: needsApproval ? 'pending' : 'approved',
      profilePhotoRejectionReason: null,
      profilePhotoSubmittedAt: new Date(),
      profilePhotoReviewedAt: needsApproval ? null : new Date(),
    });
    return freelancer;
  },

  /** Agência aprova ou recusa a foto de perfil enviada por um colaborador da rede. */
  async reviewProfilePhoto(
    freelancerId: string,
    agencyId: string,
    data: { approved: boolean; reason?: string }
  ) {
    const freelancer = await Freelancer.findByPk(freelancerId);
    if (!freelancer || freelancer.agencyId !== agencyId) throw new Error('Colaborador não encontrado.');
    if (freelancer.profilePhotoStatus !== 'pending') {
      throw new Error('Não há foto pendente de revisão para este colaborador.');
    }
    if (data.approved) {
      await freelancer.update({
        profilePhotoStatus: 'approved',
        profilePhotoReviewedAt: new Date(),
        profilePhotoRejectionReason: null,
      });
    } else {
      if (!data.reason?.trim()) throw new Error('Informe o motivo da recusa.');
      await freelancer.update({
        profilePhotoStatus: 'rejected',
        profilePhotoReviewedAt: new Date(),
        profilePhotoRejectionReason: data.reason.trim(),
      });
    }
    return freelancer;
  },

  /** Colaboradores da agência com foto pendente ou recusada (fila de revisão do onboarding). */
  async listPhotoReviewsForAgency(agencyId: string, actor?: AgencyActor | null) {
    const where: any = { agencyId, profilePhotoStatus: { [Op.in]: ['pending', 'rejected'] } };
    if (actor?.scopeFreelancerIds) where.id = { [Op.in]: actor.scopeFreelancerIds };
    return Freelancer.findAll({
      where,
      attributes: [
        'id', 'name', 'profilePhotoUrl', 'profilePhotoStatus',
        'profilePhotoRejectionReason', 'profilePhotoSubmittedAt', 'profilePhotoReviewedAt',
      ],
      order: [['profilePhotoSubmittedAt', 'DESC']],
    });
  },

  async deleteFreelancer(id: string) {
    const deleted = await Freelancer.destroy({ where: { id } });
    return deleted > 0;
  },

  async getFreelancerCategories(freelancerId: string) {
    return await FreelancerCategory.findAll({
      where: { freelancerId },
      include: [{ model: Category, as: 'category' }],
    });
  },

  /**
   * Normaliza o valor/hora recebido (número > 0). Sempre obrigatório: uma função sem
   * valor/hora não pode ser salva — o colaborador não enxergaria vagas dessa função e
   * ninguém seria avisado do cadastro incompleto.
   */
  parseHourlyRate(value: unknown): number {
    if (value == null || value === '') {
      throw new Error('Defina o valor/hora que o colaborador recebe nesta função antes de salvar.');
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('Informe um valor/hora válido para a função (um número maior que zero).');
    }
    return n;
  },

  async addCategoryToFreelancer(freelancerId: string, categoryId: string, hourlyRate?: unknown) {
    if (!categoryId) throw new Error('Informe a função.');
    const rate = this.parseHourlyRate(hourlyRate);
    const existing = await FreelancerCategory.findOne({ where: { freelancerId, categoryId } });
    if (existing) {
      await existing.update({ hourlyRate: rate });
      return existing;
    }
    return await FreelancerCategory.create({ freelancerId, categoryId, hourlyRate: rate });
  },

  /** Atualiza só o valor/hora de uma função já marcada. */
  async setCategoryRate(freelancerId: string, categoryId: string, hourlyRate: unknown) {
    const row = await FreelancerCategory.findOne({ where: { freelancerId, categoryId } });
    if (!row) throw new Error('Função não está marcada para este colaborador.');
    await row.update({ hourlyRate: this.parseHourlyRate(hourlyRate) });
    return row;
  },

  /** Valor/hora que o colaborador recebe numa função (ou null se não precificada). */
  async categoryRate(freelancerId: string, categoryId: string) {
    const row = await FreelancerCategory.findOne({ where: { freelancerId, categoryId } });
    const rate = row?.hourlyRate;
    return rate != null && Number(rate) > 0 ? Number(rate) : null;
  },

  async removeCategoryFromFreelancer(freelancerId: string, categoryId: string) {
    const deleted = await FreelancerCategory.destroy({
      where: { freelancerId, categoryId },
    });
    return deleted > 0;
  },

  // ----- Autocadastro: aprovação pela agência -----
  async listPendingForAgency(agencyId: string, actor?: AgencyActor | null) {
    const where: any = { agencyId, registrationStatus: 'pending' };
    if (actor?.scopeFreelancerIds) where.id = { [Op.in]: actor.scopeFreelancerIds };
    return Freelancer.findAll({ where, order: [['createdAt', 'DESC']] });
  },

  async approveRegistration(id: string, agencyId: string) {
    const f = await Freelancer.findOne({ where: { id, agencyId } });
    if (!f) throw new Error('Colaborador não encontrado.');
    if (f.registrationStatus !== 'pending') throw new Error('Este cadastro não está pendente.');
    await f.update({ registrationStatus: 'approved' });
    return f;
  },

  async rejectRegistration(id: string, agencyId: string) {
    const f = await Freelancer.findOne({ where: { id, agencyId } });
    if (!f) throw new Error('Colaborador não encontrado.');
    if (f.registrationStatus !== 'pending') throw new Error('Este cadastro não está pendente.');
    const userId = f.userId;
    await sequelize.transaction(async (t) => {
      await f.destroy({ transaction: t });
      if (userId) await User.destroy({ where: { id: userId }, transaction: t });
    });
    return { ok: true };
  },
};
