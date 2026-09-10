import { Supermarket, SupermarketCreationAttributes } from '../models/Supermarket';
import { User } from '../models/User';

/** Campos de perfil/cadastro que o dono do supermercado (ou a agência-cliente) pode editar. */
const PROFILE_FIELDS = [
  'name', 'legalName', 'cnpj', 'address', 'phone', 'email', 'logoUrl', 'profilePhotoUrl',
] as const;

function trimOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

export const supermarketService = {
  // Lista todos os supermercados
  async findAll() {
    return await Supermarket.findAll({ include: { model: User, as: 'owner' } });
  },

  // Busca um supermercado por ID
  async findById(id: string) {
    return await Supermarket.findByPk(id, { include: { model: User, as: 'owner' } });
  },

  // Cria um novo supermercado
  async create(data: SupermarketCreationAttributes) {
    const ownerExists = await User.findByPk(data.ownerId);
    if (!ownerExists) throw new Error('Usuário proprietário não encontrado.');

    return await Supermarket.create({ ...data });
  },

  // Atualiza um supermercado existente
  async update(id: string, data: Partial<SupermarketCreationAttributes>) {
    const supermarket = await Supermarket.findByPk(id);
    if (!supermarket) throw new Error('Supermercado não encontrado.');

    return await supermarket.update(data);
  },

  /** Atualização de perfil institucional do supermercado (whitelist). */
  async updateProfile(id: string, data: Record<string, unknown>) {
    const supermarket = await Supermarket.findByPk(id);
    if (!supermarket) throw new Error('Supermercado não encontrado.');

    const patch: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (data[field] === undefined) continue;
      if (field === 'name' || field === 'cnpj' || field === 'address') {
        const value = String(data[field] ?? '').trim();
        if (!value) throw new Error('Nome, CNPJ e endereço são obrigatórios.');
        patch[field] = value;
      } else {
        patch[field] = trimOrNull(data[field]);
      }
    }
    await supermarket.update(patch);
    return supermarket.reload();
  },

  // Remove um supermercado
  async delete(id: string) {
    const supermarket = await Supermarket.findByPk(id);
    if (!supermarket) throw new Error('Supermercado não encontrado.');

    await supermarket.destroy();
    return { message: 'Supermercado removido com sucesso.' };
  }
};
