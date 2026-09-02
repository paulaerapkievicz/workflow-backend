import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { sequelize } from './database';
import './models';
import { adminJs, adminJsRouter } from './adminjs';
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
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Configura o painel AdminJS
app.use(adminJs.options.rootPath, adminJsRouter);

app.use(router)

const PORT = Number(process.env.PORT) || 3333;
const HOST = '0.0.0.0';

// Conectar ao banco antes de iniciar o servidor
sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connection successful.');
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🎛️ AdminJS mounted at ${adminJs.options.rootPath}`);
    });
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
    process.exit(1);
  });
