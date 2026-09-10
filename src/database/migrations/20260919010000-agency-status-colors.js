'use strict';

/**
 * `agencies.status_colors` — cores dos 6 tons semânticos dos badges de status
 * (pending/progress/waiting/approved/done/canceled). Editáveis em /agency/settings;
 * valem para os badges de vaga, pedido, fatura e pagamento em todas as áreas.
 */

const DEFAULT_STATUS_COLORS = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  progress: { bg: '#dbeafe', fg: '#1e40af' },
  waiting: { bg: '#fde68a', fg: '#92400e' },
  approved: { bg: '#ede9fe', fg: '#5b21b6' },
  done: { bg: '#dcfce7', fg: '#166534' },
  canceled: { bg: '#fee2e2', fg: '#991b1b' },
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'status_colors', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: JSON.stringify(DEFAULT_STATUS_COLORS),
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'status_colors');
  },
};
