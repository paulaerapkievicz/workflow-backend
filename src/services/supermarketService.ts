import { Supermarket, SupermarketCreationAttributes } from '../models/Supermarket';
import { User } from '../models/User';

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

  // Remove um supermercado
  async delete(id: string) {
    const supermarket = await Supermarket.findByPk(id);
    if (!supermarket) throw new Error('Supermercado não encontrado.');

    await supermarket.destroy();
    return { message: 'Supermercado removido com sucesso.' };
  }
};
