'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // WhatsApp da landing pública da agência (/p/:id) — número (com DDI, pronto pro link
    // wa.me) e a mensagem pré-preenchida do botão de contato. Ambos nulos até a agência
    // configurar em /agency/profile ("Gerar link do botão").
    await queryInterface.addColumn('agencies', 'whatsapp_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await queryInterface.addColumn('agencies', 'whatsapp_message', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'whatsapp_message');
    await queryInterface.removeColumn('agencies', 'whatsapp_number');
  },
};
