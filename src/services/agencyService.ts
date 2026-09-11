import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { sequelize } from '../database';
import { Agency, AgencyCreationAttributes } from '../models/Agency';
import { User } from '../models/User';
import { Commission } from '../models/Commission';
import { ALERT_SETTING_RANGES, resolveUnfilledAlertTiers, sanitizeUnfilledAlertTiers } from '../helpers/alerts';
import { resolveStatusColors, sanitizeStatusColors } from '../helpers/statusColors';
import { sanitizeSidebarOrder } from '../helpers/sidebarOrder';
import { assertField } from '../helpers/validation';

/** Campos de perfil institucional que a própria agência (ou o admin) pode editar. */
const PROFILE_FIELDS = [
  'name', 'legalName', 'cnpj', 'address', 'phone', 'email', 'logoUrl', 'profilePhotoUrl',
] as const;

function trimOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

async function assertCnpjAvailable(cnpj: string, exceptAgencyId?: string) {
  const where: any = { cnpj };
  if (exceptAgencyId) where.id = { [Op.ne]: exceptAgencyId };
  const clash = await Agency.findOne({ where });
  if (clash) throw new Error('Já existe uma agência com esse CNPJ.');
}

export const agencyService = {
  // Busca todas as agências
  async findAll() {
    return await Agency.findAll({ order: [['name', 'ASC']] });
  },

  // Busca uma agência pelo ID
  async findById(id: string) {
    return await Agency.findByPk(id);
  },

  // Cria uma nova agência (linha crua — usado pelo AdminJS/legado)
  async create(data: AgencyCreationAttributes) {
    return await Agency.create(data);
  },

  /**
   * Cria a agência junto com o login do dono (User role 'agency') e a Commission — mesma
   * transação. Usado pelo cadastro feito pelo admin e pelo `POST /auth/register` de agência.
   */
  async createWithOwner(data: {
    name: string
    legalName?: string | null
    cnpj: string
    address: string
    phone?: string | null
    email?: string | null
    ownerName: string
    ownerEmail: string
    password: string
    commissionPercentage?: number
  }) {
    const name = String(data.name ?? '').trim();
    const address = String(data.address ?? '').trim();
    const ownerName = String(data.ownerName ?? '').trim();

    if (!name || !address) throw new Error('Informe nome, CNPJ e endereço da agência.');
    if (!ownerName || !data.ownerEmail || !data.password) {
      throw new Error('Informe nome, e-mail e senha do responsável (login da agência).');
    }
    if (String(data.password).length < 4) throw new Error('A senha deve ter ao menos 4 caracteres.');

    const cnpj = assertField(data.cnpj, 'O CNPJ da agência', 'cnpj', { required: true });
    const ownerEmail = assertField(data.ownerEmail, 'O e-mail do responsável', 'email', { required: true });
    const phone = assertField(data.phone, 'O telefone da agência', 'phone');
    const email = assertField(data.email, 'O e-mail de contato da agência', 'email');

    const emailTaken = await User.findOne({ where: { email: ownerEmail } });
    if (emailTaken) throw new Error('Este e-mail já está cadastrado.');
    await assertCnpjAvailable(cnpj);

    const pct = data.commissionPercentage != null ? Number(data.commissionPercentage) : 10;

    return sequelize.transaction(async (t) => {
      const passwordHash = await bcrypt.hash(String(data.password), 10);
      const owner = await User.create(
        { name: ownerName, email: ownerEmail, passwordHash, role: 'agency', phone: phone || null },
        { transaction: t }
      );
      const agency = await Agency.create(
        {
          ownerId: owner.id,
          name,
          legalName: trimOrNull(data.legalName),
          cnpj,
          address,
          phone: phone || undefined,
          email: email || null,
          commissionPercentage: pct,
        },
        { transaction: t }
      );
      await Commission.create({ agencyId: agency.id, percentage: pct }, { transaction: t });
      return { agency, owner };
    });
  },

  // Atualiza uma agência pelo ID (linha crua — legado)
  async update(id: string, data: Partial<Agency>) {
    const agency = await Agency.findByPk(id);
    if (!agency) return null;

    return await agency.update(data);
  },

  /** Atualização de perfil institucional (whitelist). Valida CNPJ obrigatório e único. */
  async updateProfile(agencyId: string, data: Record<string, unknown>) {
    const agency = await Agency.findByPk(agencyId);
    if (!agency) throw new Error('Agência não encontrada.');

    const patch: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (data[field] === undefined) continue;
      if (field === 'name' || field === 'address') {
        const value = String(data[field] ?? '').trim();
        if (!value) throw new Error('Nome, CNPJ e endereço são obrigatórios.');
        patch[field] = value;
      } else if (field === 'cnpj') {
        patch.cnpj = assertField(data.cnpj, 'O CNPJ da agência', 'cnpj', { required: true });
      } else if (field === 'phone') {
        patch.phone = assertField(data.phone, 'O telefone da agência', 'phone') || null;
      } else if (field === 'email') {
        patch.email = assertField(data.email, 'O e-mail da agência', 'email') || null;
      } else {
        patch[field] = trimOrNull(data[field]);
      }
    }
    if (patch.cnpj && patch.cnpj !== agency.cnpj) {
      await assertCnpjAvailable(String(patch.cnpj), agencyId);
    }
    await agency.update(patch);
    return agency.reload();
  },

  /** Admin: dados cadastrais + ativar/desativar. */
  async adminUpdate(agencyId: string, data: Record<string, unknown>) {
    const agency = await Agency.findByPk(agencyId);
    if (!agency) throw new Error('Agência não encontrada.');
    await this.updateProfile(agencyId, data);
    if (data.active !== undefined) {
      await agency.update({ active: data.active === true });
    }
    return Agency.findByPk(agencyId);
  },

  // Configurações operacionais da agência (raio de check-in, prazo de cancelamento, etc.)
  async getSettings(agencyId: string) {
    const a = await Agency.findByPk(agencyId)
    if (!a) throw new Error('Agência não encontrada.')
    return {
      id: a.id,
      checkinRadius: a.checkinRadius,
      cancellationWindowMinutes: a.cancellationWindowMinutes,
      requireCheckoutPhoto: a.requireCheckoutPhoto,
      reviewEnabled: a.reviewEnabled,
      breaksEnabled: a.breaksEnabled,
      breakLimitMinutes: a.breakLimitMinutes ?? null,
      defaultBreakMinutes: a.defaultBreakMinutes,
      maxShiftHours: Number(a.maxShiftHours),
      maxJobHours: Number(a.maxJobHours),
      checkinEarlyToleranceMinutes: a.checkinEarlyToleranceMinutes,
      alertsEnabled: a.alertsEnabled,
      notifySupermarketOnAlerts: a.notifySupermarketOnAlerts,
      lateCheckinToleranceMinutes: a.lateCheckinToleranceMinutes,
      lateCheckinCriticalMinutes: a.lateCheckinCriticalMinutes,
      earlyCheckoutToleranceMinutes: a.earlyCheckoutToleranceMinutes,
      missingCheckoutGraceMinutes: a.missingCheckoutGraceMinutes,
      unfilledAlertLeadMinutes: a.unfilledAlertLeadMinutes,
      shortNoticeWithdrawalMinutes: a.shortNoticeWithdrawalMinutes,
      unfilledAlertTiers: resolveUnfilledAlertTiers(a),
      statusColors: resolveStatusColors(a),
      sidebarOrder: a.sidebarOrder ?? null,
      onboardingRequired: a.onboardingRequired,
      uniformPrice: Number(a.uniformPrice),
      allowSelfRegistration: a.allowSelfRegistration,
      appPaymentEnabledForSupermarkets: a.appPaymentEnabledForSupermarkets,
      appPaymentEnabledForFreelancers: a.appPaymentEnabledForFreelancers,
    }
  },

  async updateSettings(
    agencyId: string,
    data: Partial<{
      checkinRadius: number
      cancellationWindowMinutes: number
      requireCheckoutPhoto: boolean
      reviewEnabled: boolean
      breaksEnabled: boolean
      breakLimitMinutes: number | string | null
      defaultBreakMinutes: number
      maxShiftHours: number
      maxJobHours: number
      checkinEarlyToleranceMinutes: number
      alertsEnabled: boolean
      notifySupermarketOnAlerts: boolean
      lateCheckinToleranceMinutes: number
      lateCheckinCriticalMinutes: number
      earlyCheckoutToleranceMinutes: number
      missingCheckoutGraceMinutes: number
      unfilledAlertLeadMinutes: number
      shortNoticeWithdrawalMinutes: number
      unfilledAlertTiers: unknown
      statusColors: unknown
      sidebarOrder: unknown
      onboardingRequired: boolean
      uniformPrice: number
      allowSelfRegistration: boolean
      appPaymentEnabledForSupermarkets: boolean
      appPaymentEnabledForFreelancers: boolean
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
    if (data.breaksEnabled != null) patch.breaksEnabled = data.breaksEnabled === true
    if (data.breakLimitMinutes !== undefined) {
      if (data.breakLimitMinutes == null || data.breakLimitMinutes === '') {
        patch.breakLimitMinutes = null
      } else {
        const n = Math.trunc(Number(data.breakLimitMinutes))
        if (!Number.isFinite(n) || n < 1 || n > 480) {
          throw new Error('Limite de pausa por turno deve ficar entre 1 e 480 minutos (ou vazio para sem limite).')
        }
        patch.breakLimitMinutes = n
      }
    }
    if (data.checkinEarlyToleranceMinutes != null) {
      const n = Math.trunc(Number(data.checkinEarlyToleranceMinutes))
      if (!Number.isFinite(n) || n < 0 || n > 240) {
        throw new Error('Antecedência do check-in deve ficar entre 0 e 240 minutos.')
      }
      patch.checkinEarlyToleranceMinutes = n
    }
    if (data.alertsEnabled != null) patch.alertsEnabled = data.alertsEnabled === true
    if (data.notifySupermarketOnAlerts != null) {
      patch.notifySupermarketOnAlerts = data.notifySupermarketOnAlerts === true
    }
    for (const [field, [min, max]] of Object.entries(ALERT_SETTING_RANGES)) {
      const raw = (data as Record<string, unknown>)[field]
      if (raw == null || raw === '') continue
      const n = Math.trunc(Number(raw))
      if (!Number.isFinite(n) || n < min || n > max) {
        throw new Error(`"${field}" deve ficar entre ${min} e ${max} minutos.`)
      }
      patch[field] = n
    }

    if (data.unfilledAlertTiers !== undefined) {
      patch.unfilledAlertTiers = sanitizeUnfilledAlertTiers(data.unfilledAlertTiers)
    }

    if (data.statusColors !== undefined) {
      patch.statusColors = sanitizeStatusColors(data.statusColors)
    }

    if (data.sidebarOrder !== undefined) {
      patch.sidebarOrder = sanitizeSidebarOrder(data.sidebarOrder)
    }

    if (data.defaultBreakMinutes != null) {
      const n = Math.trunc(Number(data.defaultBreakMinutes))
      if (!Number.isFinite(n) || n < 0 || n > 480) {
        throw new Error('Intervalo padrão deve ficar entre 0 e 480 minutos.')
      }
      patch.defaultBreakMinutes = n
    }
    const nextMaxShift =
      data.maxShiftHours != null ? Number(data.maxShiftHours) : Number(a.maxShiftHours)
    const nextMaxJob =
      data.maxJobHours != null ? Number(data.maxJobHours) : Number(a.maxJobHours)
    if (data.maxShiftHours != null) {
      if (!Number.isFinite(nextMaxShift) || nextMaxShift < 1 || nextMaxShift > 24) {
        throw new Error('Máximo de horas por turno deve ficar entre 1 e 24.')
      }
      patch.maxShiftHours = nextMaxShift
    }
    if (data.maxJobHours != null) {
      if (!Number.isFinite(nextMaxJob) || nextMaxJob < 1 || nextMaxJob > 24) {
        throw new Error('Máximo de horas por vaga deve ficar entre 1 e 24.')
      }
      patch.maxJobHours = nextMaxJob
    }
    if (nextMaxJob < nextMaxShift) {
      throw new Error('O máximo de horas por vaga não pode ser menor que o de um turno.')
    }

    if (data.onboardingRequired != null) patch.onboardingRequired = data.onboardingRequired === true
    if (data.allowSelfRegistration != null) patch.allowSelfRegistration = data.allowSelfRegistration === true
    if (data.uniformPrice != null) {
      const n = Number(data.uniformPrice)
      if (!Number.isFinite(n) || n < 0) throw new Error('Preço do uniforme inválido.')
      patch.uniformPrice = n
    }
    if (data.appPaymentEnabledForSupermarkets != null) {
      patch.appPaymentEnabledForSupermarkets = data.appPaymentEnabledForSupermarkets === true
    }
    if (data.appPaymentEnabledForFreelancers != null) {
      patch.appPaymentEnabledForFreelancers = data.appPaymentEnabledForFreelancers === true
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
