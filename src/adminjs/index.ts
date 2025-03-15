import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import AdminJsSequelize from '@adminjs/sequelize'
import { sequelize } from '../database';
import { adminJsResources } from './resources'
import { dashboardOptions } from './dashboard'
import { brandingOptions } from './branding'
import { locale } from './locale'
// import { authenticationOptions } from './authentication';

AdminJS.registerAdapter(AdminJsSequelize)

const adminJs = new AdminJS({
  databases: [sequelize], // Conecta o banco
  rootPath: '/admin', // Define a rota do painel
  resources: adminJsResources,
  branding: brandingOptions,
  locale: locale,
  dashboard: dashboardOptions,
});

// const adminJsRouter = AdminJSExpress.buildAuthenticatedRouter(
//   adminJs,
//   authenticationOptions, // Adicionando autenticação
//   null,
//   {
//     resave: false,
//     saveUninitialized: false,
//   }
// );

const adminJsRouter = AdminJSExpress.buildRouter(adminJs);

export { adminJs, adminJsRouter };
