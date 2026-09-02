import { Agency, AgencyCreationAttributes } from '../models/Agency';

export const agencyService = {
  // Busca todas as agências
  async findAll() {
    return await Agency.findAll();
  },

  // Busca uma agência pelo ID
  async findById(id: string) {
    return await Agency.findByPk(id);
  },

  // Cria uma nova agência
  async create(data: AgencyCreationAttributes) {
    return await Agency.create(data);
  },

  // Atualiza uma agência pelo ID
  async update(id: string, data: Partial<Agency>) {
    const agency = await Agency.findByPk(id);
    if (!agency) return null;
    
    return await agency.update(data);
  },

  // Configurações operacionais da agência (raio de check-in, prazo de cancelamento, etc.)
  async getSettings(agencyId: string) {
    const a = await Agency.findByPk(agencyId)
    if (!a) throw new Error('Agência não encontrada.')
    return {
      id: a.id,
      commissionPercentage: Number(a.commissionPercentage),
      checkinRadius: a.checkinRadius,
      cancellationWindowMinutes: a.cancellationWindowMinutes,
      requireCheckoutPhoto: a.requireCheckoutPhoto,
      reviewEnabled: a.reviewEnabled,
      onboardingRequired: a.onboardingRequired,
      uniformPrice: Number(a.uniformPrice),
      allowSelfRegistration: a.allowSelfRegistration,
    }
  },

  async updateSettings(
    agencyId: string,
    data: Partial<{
      checkinRadius: number
      cancellationWindowMinutes: number
      requireCheckoutPhoto: boolean
      reviewEnabled: boolean
      commissionPercentage: number
      onboardingRequired: boolean
      uniformPrice: number
      allowSelfRegistration: boolean
    }>
  ) {
    const a = await Agency.findByPk(agencyId)
    if (!a) throw new Error('Agência não encontrada.')
    const patch: any = {}

    if (data.checkinRadius != null) {
      const n = Math.trunc(Number(data.checkinRadius))
      if (!Number.isFinite(n) || n < 20 || n > 5000) throw new Error('Raio de check-in deve ficar entre 20 e 5000 metros.')
      patch.checkinRadius = n
    }
    if (data.cancellationWindowMinutes != null) {
      const n = Math.trunc(Number(data.cancellationWindowMinutes))
      if (!Number.isFinite(n) || n < 0 || n > 10080) throw new Error('Prazo de cancelamento inválido.')
      patch.cancellationWindowMinutes = n
    }
    if (data.requireCheckoutPhoto != null) patch.requireCheckoutPhoto = data.requireCheckoutPhoto === true
    if (data.reviewEnabled != null) patch.reviewEnabled = data.reviewEnabled === true
    if (data.onboardingRequired != null) patch.onboardingRequired = data.onboardingRequired === true
    if (data.allowSelfRegistration != null) patch.allowSelfRegistration = data.allowSelfRegistration === true
    if (data.uniformPrice != null) {
      const n = Number(data.uniformPrice)
      if (!Number.isFinite(n) || n < 0) throw new Error('Preço do uniforme inválido.')
      patch.uniformPrice = n
    }
    if (data.commissionPercentage != null) {
      const n = Number(data.commissionPercentage)
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Comissão deve ficar entre 0 e 100%.')
      patch.commissionPercentage = n
    }

    await a.update(patch)
    return this.getSettings(agencyId)
  },

  // Exclui uma agência pelo ID
  async delete(id: string) {
    const agency = await Agency.findByPk(id);
    if (!agency) return false;
    
    await agency.destroy();
    return true;
  }
};
