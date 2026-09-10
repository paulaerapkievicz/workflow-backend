'use strict';

/**
 * Cargos configuráveis da equipe (tags tipo "Administrador", "Gerente", "RH"…).
 * Cada supermercado gerencia a própria lista; cada agência, a dela.
 * O membro (supermarket_members / agency_members) aponta para um cargo (opcional).
 */
const DEFAULT_SUPERMARKET_ROLES = ['Administrador', 'Gerente', 'RH', 'Financeiro', 'Comprador'];
const DEFAULT_AGENCY_ROLES = ['Administrador', 'Gerente', 'RH', 'Operações', 'Comercial'];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('team_roles', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      scope: { type: Sequelize.STRING, allowNull: false }, // 'supermarket' | 'agency'
      owner_id: { type: Sequelize.UUID, allowNull: false }, // supermarkets.id ou agencies.id
      name: { type: Sequelize.STRING, allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('team_roles', {
      fields: ['scope', 'owner_id', 'name'],
      type: 'unique',
      name: 'team_roles_scope_owner_name_uk',
    });
    await queryInterface.addIndex('team_roles', ['scope', 'owner_id'], { name: 'team_roles_scope_owner_idx' });

    await queryInterface.addColumn('supermarket_members', 'team_role_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'team_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('agency_members', 'team_role_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'team_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: lista padrão para cada supermercado e agência já existentes.
    const [supermarkets] = await queryInterface.sequelize.query('SELECT id FROM supermarkets');
    const [agencies] = await queryInterface.sequelize.query('SELECT id FROM agencies');

    const rows = [];
    const stamp = 'NOW()';
    for (const s of supermarkets) {
      DEFAULT_SUPERMARKET_ROLES.forEach((name, i) => {
        rows.push({ scope: 'supermarket', owner_id: s.id, name, position: i });
      });
    }
    for (const a of agencies) {
      DEFAULT_AGENCY_ROLES.forEach((name, i) => {
        rows.push({ scope: 'agency', owner_id: a.id, name, position: i });
      });
    }
    if (rows.length) {
      const values = rows
        .map(
          (r) =>
            `(gen_random_uuid(), '${r.scope}', '${r.owner_id}', '${r.name.replace(/'/g, "''")}', ${r.position}, ${stamp}, ${stamp})`
        )
        .join(',');
      await queryInterface.sequelize.query(
        `INSERT INTO team_roles (id, scope, owner_id, name, position, created_at, updated_at) VALUES ${values}`
      );
    }

    // Dono de cada supermercado já cadastrado recebe o cargo "Administrador".
    await queryInterface.sequelize.query(`
      UPDATE supermarket_members sm
      SET team_role_id = tr.id
      FROM team_roles tr
      WHERE sm.is_owner = true
        AND tr.scope = 'supermarket'
        AND tr.owner_id = sm.supermarket_id
        AND tr.name = 'Administrador'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('supermarket_members', 'team_role_id');
    await queryInterface.removeColumn('agency_members', 'team_role_id');
    await queryInterface.dropTable('team_roles');
  },
};
