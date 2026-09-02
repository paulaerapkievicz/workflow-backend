import { Branch, BranchCreationAttributes } from '../models/Branch';
import { Supermarket } from '../models/Supermarket';
import { geocodeAddress } from '../helpers/geocode';

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

    const payload: any = { ...data, ...manualCoords(data as any) };
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

  async delete(id: string) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');
    await branch.destroy();
    return { message: 'Filial removida com sucesso.' };
  },
};
