'use strict';

/**
 * `agencies.unfilled_alert_tiers` — faixas das bolinhas de "vaga sem colaborador" na tela de
 * Convocações (minutos antes do início, cor, rótulo, se pisca). Editáveis em /agency/settings.
 */

const DEFAULT_TIERS = [
  { id: 'tier-60', minutesBefore: 60, color: '#EAB308', label: 'Falta 1h', blink: false },
  { id: 'tier-30', minutesBefore: 30, color: '#F97316', label: 'Falta 30 min', blink: true },
  { id: 'tier-0', minutesBefore: 0, color: '#DC2626', label: 'No horário / atrasada', blink: true },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'unfilled_alert_tiers', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: JSON.stringify(DEFAULT_TIERS),
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'unfilled_alert_tiers');
  },
};
