import { Session, SessionCreationAttributes } from '../models/Session';

export const sessionService = {
  async create(data: SessionCreationAttributes) {
    return Session.create(data);
  },

  async getByToken(token: string) {
    return Session.findOne({ where: { token } });
  },

  async deleteByToken(token: string) {
    const deletedRows = await Session.destroy({ where: { token } });
    return deletedRows > 0;
  },

  async deleteByUserId(userId: string) {
    const deletedRows = await Session.destroy({ where: { userId } });
    return deletedRows > 0;
  },
};
