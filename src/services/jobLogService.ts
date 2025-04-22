// src/services/jobLogService.ts

import { JobLog, JobLogCreationAttributes } from '../models/JobLog';

export const jobLogService = {
  // Lista todos os logs sem filtros
  async findAll() {
    return await JobLog.findAll(); // Retorna todos os logs
  },

  // Lista todos os logs de um trabalho específico
  async findByJob(jobId: string) {
    return await JobLog.findAll({ where: { jobId } });
  },

  // Buscar todos os logs de trabalho de um freelancer
  async findByFreelancer(freelancerId: string) {
    return await JobLog.findAll({ where: { freelancerId } });
  },

  // Buscar logs por status
  async findByStatus(status: string) {
    // Certifique-se de que o status seja válido
    const validStatuses = ['check-in', 'check-out', 'break-start', 'break-end'];

    if (!validStatuses.includes(status)) {
      throw new Error('Status inválido');
    }

    return await JobLog.findAll({
      where: {
        event_type: status,
      },
    });
  },

  // Registra um check-in
  async checkIn(jobId: string, freelancerId: string) {
    return await JobLog.create({ jobId, freelancerId, eventType: 'check-in' } as JobLogCreationAttributes);
  },

  // Registra início de intervalo
  async registerInterval(jobId: string, freelancerId: string, eventType: string) {
    if (!['break-start', 'break-end'].includes(eventType)) {
      throw new Error('Invalid event type for interval.');
    }
    return await JobLog.create({ jobId, freelancerId, eventType } as JobLogCreationAttributes);
  },
  // 💡 Outro ponto legal:
  // Quando for salvar o checkOut no JobLog, e quiser automatizar o endTime no Job (se for regra da tua lógica) — o service de logs poderia, além de gravar o log, atualizar o Job.endTime com o último log check-out daquele job.
  // if (eventType === 'check-out') {
  //   await Job.update(
  //     { endTime: new Date() },
  //     { where: { id: jobId } }
  //   );
  // }
  
  // Registra um check-out
  async checkOut(jobId: string, freelancerId: string) {
    return await JobLog.create({ jobId, freelancerId, eventType: 'check-out' } as JobLogCreationAttributes);
  }
};
