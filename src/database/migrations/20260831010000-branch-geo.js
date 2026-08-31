'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('branches', 'latitude', {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });
    await queryInterface.addColumn('branches', 'longitude', {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });
    await queryInterface.addColumn('branches', 'geofence_radius', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 300,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('branches', 'latitude');
    await queryInterface.removeColumn('branches', 'longitude');
    await queryInterface.removeColumn('branches', 'geofence_radius');
  },
};
