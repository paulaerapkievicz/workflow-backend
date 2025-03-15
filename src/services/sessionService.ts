import { Session } from '../models';

interface CreateSessionData {
  user_id: string;
  token: string;
  expires_at: Date;
}

export const sessionService = {
  // 📌 Cria uma nova sessão
  async create(data: CreateSessionData) {
    return await Session.create(data);
  },

  // 🔍 Obtém uma sessão pelo token
  async getByToken(token: string) {
    return await Session.findOne({ where: { token } });
  },

  // ❌ Remove uma sessão pelo token
  async deleteByToken(token: string) {
    const deletedRows = await Session.destroy({ where: { token } });
    return deletedRows > 0;
  },

  // ❌ Remove todas as sessões de um usuário
  async deleteByUserId(user_id: string) {
    const deletedRows = await Session.destroy({ where: { user_id } });
    return deletedRows > 0;
  },
};
