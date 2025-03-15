import express from 'express';
import cors from 'cors';
import { sequelize } from './database';
import { adminJs, adminJsRouter } from './adminjs';
import { router } from './routes'

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configura o painel AdminJS
app.use(adminJs.options.rootPath, adminJsRouter);

app.use(router)

const PORT = process.env.PORT || 3000;

// Conectar ao banco antes de iniciar o servidor
sequelize.authenticate()
  .then(() => {
    console.log('✅ DB connection successful.');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🎛️ AdminJS running on http://localhost:${PORT}${adminJs.options.rootPath}`);
    });
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });
