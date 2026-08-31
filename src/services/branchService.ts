import { Branch, BranchCreationAttributes } from '../models/Branch';
import { Supermarket } from '../models/Supermarket';

// Converte lat/long/raio para número (ou null) quando vierem no payload.
function normalizeGeo<T extends Record<string, any>>(data: T): T {
  const out: Record<string, any> = { ...data };
  for (const key of ['latitude', 'longitude'] as const) {
    if (key in out) {
      const n = out[key] === '' || out[key] == null ? null : Number(out[key]);
      out[key] = n != null && Number.isFinite(n) ? n : null;
    }
  }
  if ('geofenceRadius' in out) {
    const n = Number(out.geofenceRadius);
    out.geofenceRadius = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 300;
  }
  return out as T;
}

export const branchService = {
  // Lista todas as filiais
  async findAll() {
    return await Branch.findAll({ include: { model: Supermarket, as: 'supermarket' } });
  },

  // Busca uma filial por ID
  async findById(id: string) {
    return await Branch.findByPk(id, { include: { model: Supermarket, as: 'supermarket' } });
  },

  // Cria uma nova filial
  async create(data: BranchCreationAttributes) {
    if (!data.name || !data.address) {
      throw new Error('Nome e endereço são obrigatórios.');
    }
    const supermarketExists = await Supermarket.findByPk(data.supermarketId);
    if (!supermarketExists) throw new Error('Supermercado não encontrado.');

    return await Branch.create(normalizeGeo(data));
  },

  // Atualiza uma filial existente
  async update(id: string, data: Partial<BranchCreationAttributes>) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');

    return await branch.update(normalizeGeo(data));
  },

  // Remove uma filial
  async delete(id: string) {
    const branch = await Branch.findByPk(id);
    if (!branch) throw new Error('Filial não encontrada.');

    await branch.destroy();
    return { message: 'Filial removida com sucesso.' };
  }
};