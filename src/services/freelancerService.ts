import { sequelize } from '../database';
import { Freelancer } from '../models/Freelancer';
import { FreelancerCategory } from '../models/FreelancerCategory';
import { Category } from '../models/Category';
import { User } from '../models/User';

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

  /** Normaliza o valor/hora recebido (número > 0) ou retorna null. */
  parseHourlyRate(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Informe um valor/hora válido para a função.');
    return n;
  },

  async addCategoryToFreelancer(freelancerId: string, categoryId: string, hourlyRate?: unknown) {
    if (!categoryId) throw new Error('Informe a função.');
    const rate = this.parseHourlyRate(hourlyRate);
    const existing = await FreelancerCategory.findOne({ where: { freelancerId, categoryId } });
    if (existing) {
      if (rate != null) await existing.update({ hourlyRate: rate });
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
  async listPendingForAgency(agencyId: string) {
    return Freelancer.findAll({
      where: { agencyId, registrationStatus: 'pending' },
      order: [['createdAt', 'DESC']],
    });
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
