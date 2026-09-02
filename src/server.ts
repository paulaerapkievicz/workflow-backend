import 'dotenv/config';
import path from 'path';
import express, { RequestHandler } from 'express';
import cors from 'cors';
import { sequelize } from './database';
import './models';
import { router } from './routes'

const app = express();

// Em produção restringe o CORS às origens do front (lista separada por vírgula
// em FRONTEND_BASE_URL); em dev libera geral.
const allowedOrigins = (process.env.FRONTEND_BASE_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }),
);

// O AdminJS empacota (bundle) os componentes do painel no boot, o que leva
// alguns segundos. Para não atrasar o listen (e o health check do Railway),
// ele é carregado de forma assíncrona logo abaixo; até lá o /admin responde 503.
let adminJsHandler: RequestHandler | null = null;
app.use('/admin', (req, res, next) => {
  if (adminJsHandler) return adminJsHandler(req, res, next);
  res.status(503).type('text').send('Painel administrativo inicializando, tente novamente em instantes.');
});

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Health check simples — responde antes mesmo do banco conectar.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(router)

const PORT = Number(process.env.PORT) || 3333;
const HOST = '0.0.0.0';

// Sobe o servidor HTTP imediatamente (porta aberta = sem 502) e faz o resto
// (banco, AdminJS) em paralelo, logando erros sem derrubar o processo.
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

sequelize.authenticate()
  .then(() => console.log('✅ DB connection successful.'))
  .catch(err => console.error('❌ Unable to connect to the database:', err));

import('./adminjs')
  .then(({ adminJs, adminJsRouter }) => {
    adminJsHandler = adminJsRouter;
    console.log(`🎛️ AdminJS mounted at ${adminJs.options.rootPath}`);
  })
  .catch(err => console.error('❌ Falha ao montar o AdminJS:', err));
