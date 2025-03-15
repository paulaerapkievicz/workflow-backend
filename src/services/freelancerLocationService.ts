import { FreelancerLocation } from '../models/FreelancerLocation';

export const freelancerLocationService = {
  async trackLocation(freelancerId: string, jobId: string, latitude: number, longitude: number) {
    return FreelancerLocation.create({
      freelancerId,
      jobId,
      latitude,
      longitude,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },
  // Salva a localização de um freelancer
  async getLocationsByJob(freelancerId: string, jobId: string) {
    return FreelancerLocation.findAll({
      where: { freelancerId, jobId },
      order: [['timestamp', 'ASC']],
    });
  },

//pegar a última localização de um freelancer
  async getLatestLocationByFreelancer(freelancerId: string) {
    return FreelancerLocation.findOne({
      where: { freelancerId },
      order: [['timestamp', 'DESC']],
    });
  },
};
