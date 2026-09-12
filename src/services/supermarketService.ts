import { Supermarket, SupermarketCreationAttributes } from '../models/Supermarket';
import { User } from '../models/User';
import { assertField } from '../helpers/validation';
import { sanitizeSidebarOrder } from '../helpers/sidebarOrder';

/** Campos de perfil/cadastro que o dono do supermercado (ou a agência-cliente) pode editar. */
const PROFILE_FIELDS = [
  'name', 'legalName', 'cnpj', 'address', 'phone', 'email', 'logoUrl', 'profilePhotoUrl',
] as const;

function trimOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

export const supermarketService = {
  // Lista os supermercados de uma agência (o chamador sempre informa a própria agencyId).
  async findAll(agencyId?: string) {
    return await Supermarket.findAll({
      where: agencyId ? { agencyId } : undefined,
      include: { model: User, as: 'owner', attributes: { exclude: ['passwordHash'] } },
    });
  },

  // Busca um supermercado por ID
  async findById(id: string) {
    return await Supermarket.findByPk(id, {
      include: { model: User, as: 'owner', attributes: { exclude: ['passwordHash'] } },
    });
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
      if (field === 'name' || field === 'address') {
        const value = String(data[field] ?? '').trim();
        if (!value) throw new Error('Nome, CNPJ e endereço são obrigatórios.');
        patch[field] = value;
      } else if (field === 'cnpj') {
        patch.cnpj = assertField(data.cnpj, 'O CNPJ do supermercado', 'cnpj', { required: true });
      } else if (field === 'phone') {
        patch.phone = assertField(data.phone, 'O telefone do supermercado', 'phone') || null;
      } else if (field === 'email') {
        patch.email = assertField(data.email, 'O e-mail do supermercado', 'email') || null;
      } else {
        patch[field] = trimOrNull(data[field]);
      }
    }
    await supermarket.update(patch);
    return supermarket.reload();
  },

  /** Ordem personalizada do menu lateral — só o dono da rede edita (controller checa). */
  async updateSidebarOrder(id: string, raw: unknown) {
    const supermarket = await Supermarket.findByPk(id);
    if (!supermarket) throw new Error('Supermercado não encontrado.');
    await supermarket.update({ sidebarOrder: sanitizeSidebarOrder(raw) });
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
