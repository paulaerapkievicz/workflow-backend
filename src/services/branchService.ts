import { Branch, BranchCreationAttributes } from '../models/Branch';
import { Supermarket } from '../models/Supermarket';
import { geocodeAddress } from '../helpers/geocode';
import { resolveBranchProfile } from '../helpers/branchProfile';
import { assertField } from '../helpers/validation';

/** Dados cadastrais próprios da filial (vazio = herda da matriz). */
const PROFILE_FIELDS = [
  'name', 'address', 'phone', 'legalName', 'cnpj', 'email', 'logoUrl', 'profilePhotoUrl',
] as const;

function trimOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

// Coordenadas manuais explícitas no payload (opcional — normalmente vêm da geocodificação).
function manualCoords(data: Record<string, any>) {
  const out: { latitude?: number | null; longitude?: number | null } = {};
  for (const key of ['latitude', 'longitude'] as const) {
    if (key in data && data[key] !== '' && data[key] != null) {
      const n = Number(data[key]);
      if (Number.isFinite(n)) out[key] = n;
    }
  }
  return out;
}

export const branchService = {
  async findAll() {
    return Branch.findAll({ include: { model: Supermarket, as: 'supermarket' } });
  },

  async findById(id: string) {
    return Branch.findByPk(id, { include: { model: Supermarket, as: 'supermarket' } });
  },

  /** Prévia de geocodificação (não salva) — usada pelo botão "buscar coordenadas do endereço". */
  async geocode(address: string) {
    const point = await geocodeAddress(address);
    if (!point) throw new Error('Não foi possível localizar esse endereço. Revise ou informe as coordenadas manualmente.');
    return point;
  },

  async create(data: BranchCreationAttributes) {
    if (!data.name || !data.address) throw new Error('Nome e endereço são obrigatórios.');
    const supermarketExists = await Supermarket.findByPk(data.supermarketId);
    if (!supermarketExists) throw new Error('Supermercado não encontrado.');

    const phone = assertField((data as Record<string, unknown>).phone, 'O telefone da filial', 'phone');
    const payload: any = { ...data, phone: phone || null, ...manualCoords(data as any) };
    if (payload.latitude == null || payload.longitude == null) {
      const point = await geocodeAddress(data.address);
      if (point) {
        payload.latitude = point.latitude;
        payload.longitude = point.longitude;
        payload.geocodedAt = new Date();
        payload.geocodeQuery = data.address;
      }
    } else {
      payload.geocodedAt = new Date();
      payload.geocodeQuery = data.address;
    }
    return Branch.create(payload);
  },

  async update(id: string, data: Partial<BranchCreationAttributes> & Record<string, any>) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');

    const patch: any = { ...data, ...manualCoords(data) };
    const addressChanged = data.address != null && data.address !== branch.address;
    const gaveManual = 'latitude' in patch && 'longitude' in patch && patch.latitude != null;

    if (gaveManual) {
      patch.geocodedAt = new Date();
      patch.geocodeQuery = data.address ?? branch.address;
    } else if (addressChanged || data.regeocode === true) {
      const point = await geocodeAddress(data.address ?? branch.address);
      if (point) {
        patch.latitude = point.latitude;
        patch.longitude = point.longitude;
        patch.geocodedAt = new Date();
        patch.geocodeQuery = data.address ?? branch.address;
      }
    }
    delete patch.regeocode;
    return branch.update(patch);
  },

  /**
   * Atualiza os dados cadastrais da filial (whitelist). Reaproveita `update` para o
   * re-geocode quando o endereço muda.
   */
  async updateProfile(id: string, data: Record<string, unknown>) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');

    const patch: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (data[field] === undefined) continue;
      if (field === 'name' || field === 'address') {
        const value = String(data[field] ?? '').trim();
        if (!value) throw new Error('Nome e endereço da filial são obrigatórios.');
        patch[field] = value;
      } else if (field === 'cnpj') {
        patch.cnpj = assertField(data.cnpj, 'O CNPJ da filial', 'cnpj') || null;
      } else if (field === 'phone') {
        patch.phone = assertField(data.phone, 'O telefone da filial', 'phone') || null;
      } else if (field === 'email') {
        patch.email = assertField(data.email, 'O e-mail da filial', 'email') || null;
      } else {
        patch[field] = trimOrNull(data[field]);
      }
    }
    return this.update(id, patch as any);
  },

  /** Perfil efetivo (com herança da matriz) de uma filial. */
  async resolvedProfile(id: string) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');
    const market = await Supermarket.findByPk(branch.supermarketId);
    return { branch, profile: resolveBranchProfile(branch, market) };
  },

  async approveForAgency(id: string, agencyId: string, approvedBy: string) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');
    const market = await Supermarket.findByPk(branch.supermarketId);
    if (!market || market.agencyId !== agencyId) throw new Error('Esta filial não pertence a um cliente da sua agência.');
    if (branch.serviceStatus === 'approved') throw new Error('Esta filial já está aprovada.');
    return branch.update({ serviceStatus: 'approved', approvedAt: new Date(), approvedBy });
  },

  async delete(id: string) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');
    await branch.destroy();
    return { message: 'Filial removida com sucesso.' };
  },
};
