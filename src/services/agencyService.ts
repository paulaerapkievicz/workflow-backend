import { Agency, AgencyCreationAttributes } from '../models/Agency';

export const agencyService = {
  // Busca todas as agências
  async findAll() {
    return await Agency.findAll();
  },

  // Busca uma agência pelo ID
  async findById(id: string) {
    return await Agency.findByPk(id);
  },

  // Cria uma nova agência
  async create(data: AgencyCreationAttributes) {
    return await Agency.create(data);
  },

  // Atualiza uma agência pelo ID
  async update(id: string, data: Partial<Agency>) {
    const agency = await Agency.findByPk(id);
    if (!agency) return null;
    
    return await agency.update(data);
  },

  // Exclui uma agência pelo ID
  async delete(id: string) {
    const agency = await Agency.findByPk(id);
    if (!agency) return false;
    
    await agency.destroy();
    return true;
  }
};
