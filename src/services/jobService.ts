import { Job, JobCreationAttributes } from '../models/Job';
import { Freelancer } from '../models/Freelancer';
import { Category } from '../models/Category';
import { Branch } from '../models/Branch';
import { Supermarket } from '../models/Supermarket';

export const jobService = {
  // Lista todos os trabalhos
  async findAll() {
    return await Job.findAll({
      include: [
        { model: Supermarket, as: 'jobSupermarket' },
        { model: Branch, as: 'jobBranch' },
        { model: Category, as: 'jobCategory' },
        { model: Freelancer, as: 'assignedFreelancer' }
      ]
    });
  },

  // Busca um trabalho por ID
  async findById(id: string) {
    return await Job.findAll({
      include: [
        { model: Supermarket, as: 'jobSupermarket' },
        { model: Branch, as: 'jobBranch' },
        { model: Category, as: 'jobCategory' },
        { model: Freelancer, as: 'assignedFreelancer' }
      ]
    });
  },

  // Cria um novo trabalho
  async create(data: JobCreationAttributes) {
    return await Job.create(data);
  },

  // Atualiza um trabalho existente
  async update(id: string, data: Partial<JobCreationAttributes>) {
    const job = await Job.findByPk(id);
    if (!job) throw new Error('Trabalho não encontrado.');
    
    await job.update(data);
    return await Job.findByPk(id); // Retorna os dados atualizados
  },

  // Remove um trabalho
  async delete(id: string) {
    const job = await Job.findByPk(id);
    if (!job) throw new Error('Trabalho não encontrado.');

    await job.destroy();
    return { message: 'Trabalho removido com sucesso.' };
  }
};
