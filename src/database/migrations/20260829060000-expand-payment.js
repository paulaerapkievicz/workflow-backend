'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'gross_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('payments', 'agency_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('payments', 'freelancer_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('payments', 'paid_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'released_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query('ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;');
    await queryInterface.sequelize.query(
      'ALTER TABLE "payments" ALTER COLUMN "status" TYPE VARCHAR(255) USING "status"::text;'
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE \"payments\" ALTER COLUMN \"status\" SET DEFAULT 'pending';"
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payments', 'gross_amount');
    await queryInterface.removeColumn('payments', 'agency_amount');
    await queryInterface.removeColumn('payments', 'freelancer_amount');
    await queryInterface.removeColumn('payments', 'paid_at');
    await queryInterface.removeColumn('payments', 'released_at');

    await queryInterface.sequelize.query('ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;');
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_payments_status\" AS ENUM ('pending', 'paid', 'canceled');"
    );
    await queryInterface.sequelize.query(
      "UPDATE \"payments\" SET \"status\" = 'pending' WHERE \"status\" NOT IN ('pending','paid','canceled');"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "payments" ALTER COLUMN "status" TYPE "enum_payments_status" USING "status"::"enum_payments_status";'
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE \"payments\" ALTER COLUMN \"status\" SET DEFAULT 'pending';"
    );
  },
};
