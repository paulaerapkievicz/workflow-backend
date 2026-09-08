import { Op } from 'sequelize';
import { sequelize } from '../database';
import { Freelancer } from '../models/Freelancer';
import { FreelancerCategory } from '../models/FreelancerCategory';
import { Category } from '../models/Category';
import { User } from '../models/User';
import { AgencyActor } from '../helpers/agencyScope';

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

  async updateFreelancer(id: string, data: any) {
    const freelancer = await Freelancer.findByPk(id);
    if (!freelancer) return null;

    // Só campos de perfil — nunca agencyId / saldo / userId.
    const patch: Record<string, unknown> = {};
    for (const field of ['name', 'email', 'phone', 'skills'] as const) {
      if (data[field] !== undefined) patch[field] = data[field];
    }
    return await freelancer.update(patch);
  },

  async setProfilePhoto(freelancerId: string, url: string) {
    const freelancer = await Freelancer.findByPk(freelancerId);
    if (!freelancer) throw new Error('Colaborador não encontrado.');
    await freelancer.update({ profilePhotoUrl: url });
    return freelancer;
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
