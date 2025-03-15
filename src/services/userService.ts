import { User, UserCreationAttributes } from '../models/User';
import bcrypt from 'bcrypt';

export const userService = {
  // Busca todos os usuários (sem expor a senha)
  async getAllUsers() {
    return await User.findAll({ attributes: { exclude: ['passwordHash'] } });
  },

  // Busca um usuário pelo ID (sem expor a senha)
  async getUserById(id: string) {
    return await User.findByPk(id, { attributes: { exclude: ['passwordHash'] } });
  },

  // Cria um novo usuário com senha hashada
  async createUser(userData: UserCreationAttributes) {
    const hashedPassword = await bcrypt.hash(userData.passwordHash, 10);
    return await User.create({ ...userData, passwordHash: hashedPassword });
  },

  // Atualiza um usuário pelo ID (com hash de senha, se necessário)
  async updateUser(id: string, updateData: Partial<UserCreationAttributes>) {
    const user = await User.findByPk(id);
    if (!user) return null;

    if (updateData.passwordHash) {
      updateData.passwordHash = await bcrypt.hash(updateData.passwordHash, 10);
    }

    return await user.update(updateData);
  },

  // Deleta um usuário pelo ID
  async deleteUser(id: string) {
    const deletedRows = await User.destroy({ where: { id } });
    return deletedRows > 0;
  },
};
