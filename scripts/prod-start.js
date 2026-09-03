// Start de produção: roda as migrations e sobe o servidor.
// Se a migration falhar, loga e sobe o servidor mesmo assim — assim o host
// de deploy não fica em 502 e o erro real aparece nos logs.
// App single-fuso (Brasil). Garante o fuso mesmo se o host não passar TZ.
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

const { execSync } = require('child_process');

function run(label, cmd) {
  try {
    console.log(`▶️  ${label}...`);
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✅ ${label} OK.`);
  } catch (err) {
    console.error(`⚠️  ${label} falhou — seguindo mesmo assim.`);
    console.error(err.message);
  }
}

run('Migrations', 'npx --no-install sequelize db:migrate');

// Popula o banco (categorias/funções + logins demo) apenas quando RUN_SEED=true.
// Rode uma vez e depois remova a variável de ambiente.
if (String(process.env.RUN_SEED).toLowerCase() === 'true') {
  run('Seed', 'npx --no-install sequelize db:seed:all');
}

require('../dist/server.js');
