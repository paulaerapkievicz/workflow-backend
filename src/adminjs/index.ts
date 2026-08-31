import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import AdminJsSequelize from '@adminjs/sequelize'
import { sequelize } from '../database';
import { adminJsResources } from './resources'
import { dashboardOptions } from './dashboard'
import { brandingOptions } from './branding'
import { locale } from './locale'
import { authenticationOptions } from './authentication';

AdminJS.registerAdapter(AdminJsSequelize)

const adminJs = new AdminJS({
  databases: [sequelize],
  rootPath: '/admin',
  resources: adminJsResources,
  branding: brandingOptions,
  locale: locale,
  dashboard: dashboardOptions,
});

const adminJsRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  authenticationOptions,
  null,
  {
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIE_SECRET || 'dev-workflow-cookie-secret-change-me',
  }
);

export { adminJs, adminJsRouter };
