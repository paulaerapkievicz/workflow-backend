const { v4: uuidv4 } = require('uuid');
module.exports = {
  async up(queryInterface) {
    const freelancers = await queryInterface.sequelize.query(
      'SELECT id FROM freelancers;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    const jobs = await queryInterface.sequelize.query(
      'SELECT id FROM jobs;',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (!freelancers.length || !jobs.length) return;
    
    const locations = [];
    freelancers.forEach(freelancer => {
      jobs.forEach(job => {
        locations.push({
          id: uuidv4(),
          freelancer_id: freelancer.id,
          job_id: job.id,
          latitude: parseFloat((Math.random() * 180 - 90).toFixed(6)),
          longitude: parseFloat((Math.random() * 360 - 180).toFixed(6)),
          timestamp: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
    });
    await queryInterface.bulkInsert('freelancer_locations', locations, {});
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('freelancer_locations', null, {});
  }
};
