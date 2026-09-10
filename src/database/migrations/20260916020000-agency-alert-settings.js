'use strict';

/**
 * Parâmetros do controle de ocorrências, por agência (editáveis em /agency/settings).
 * Todas com default — o backfill dos registros existentes é automático.
 */

const COLUMNS = {
  alerts_enabled: { type: 'BOOLEAN', allowNull: false, defaultValue: true },
  notify_supermarket_on_alerts: { type: 'BOOLEAN', allowNull: false, defaultValue: true },
  late_checkin_tolerance_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 10 },
  late_checkin_critical_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 30 },
  early_checkout_tolerance_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 15 },
  missing_checkout_grace_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 20 },
  unfilled_alert_lead_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 120 },
  short_notice_withdrawal_minutes: { type: 'INTEGER', allowNull: false, defaultValue: 180 },
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [name, spec] of Object.entries(COLUMNS)) {
      await queryInterface.addColumn('agencies', name, {
        type: spec.type === 'BOOLEAN' ? Sequelize.BOOLEAN : Sequelize.INTEGER,
        allowNull: spec.allowNull,
        defaultValue: spec.defaultValue,
      });
    }
  },

  async down(queryInterface) {
    for (const name of Object.keys(COLUMNS)) {
      await queryInterface.removeColumn('agencies', name);
    }
  },
};
