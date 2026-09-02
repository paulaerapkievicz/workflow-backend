'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('branches', 'geocoded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('branches', 'geocode_query', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // O raio de check-in passa a ser configurado pela agência.
    await queryInterface.removeColumn('branches', 'geofence_radius');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('branches', 'geofence_radius', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 300,
    });
    await queryInterface.removeColumn('branches', 'geocoded_at');
    await queryInterface.removeColumn('branches', 'geocode_query');
  },
};
