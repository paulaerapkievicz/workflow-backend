import { Commission, CommissionCreationAttributes } from '../models/Commission';

export const commissionService = {
  async create(data: CommissionCreationAttributes) {
    return Commission.create(data);
  },

  async getAll() {
    return Commission.findAll();
  },

  async getById(id: string) {
    return Commission.findByPk(id);
  },

  async update(id: string, data: Partial<CommissionCreationAttributes>) {
    const [updatedRows] = await Commission.update(data, { where: { id } });
    return updatedRows > 0;
  },

  async delete(id: string) {
    const deletedRows = await Commission.destroy({ where: { id } });
    return deletedRows > 0;
  },
};
