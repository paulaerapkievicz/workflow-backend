import express from 'express';
import { userController } from './controllers/userController';
import { supermarketController } from './controllers/supermarketController';
import { branchController } from './controllers/branchController';
import { agencyController } from './controllers/agencyController';
import { freelancerController } from './controllers/freelancerController';
import { categoryController } from './controllers/categoryController';
import { jobController } from './controllers/jobController';
import { jobLogsController } from './controllers/jobLogsController';
import { freelancerLocationController } from './controllers/freelancerLocationController';
import { invoiceController } from './controllers/invoiceController';
import { paymentController } from './controllers/paymentController';
// import { ensureAuth } from './middlewares/auth';
// import { authController } from './controllers/authController';
// import { reviewsController } from './controllers/reviewsController';
// import { paymentsController } from './controllers/paymentsController';
// import { invoicesController } from './controllers/invoicesController';
// import { commissionsController } from './controllers/commissionsController';

// Criando Router
const router = express.Router();

// // Autenticação
// router.post('/auth/register', authController.register);
// router.post('/auth/login', authController.login);
// router.get('/auth/me', ensureAuth, authController.me);
// router.post('/auth/logout', ensureAuth, authController.logout);

// Usuários
router.get('/users', userController.index);
router.get('/users/:id', userController.show);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

// Supermercados
router.post('/supermarkets', supermarketController.create);
router.get('/supermarkets', supermarketController.index);
router.get('/supermarkets/:id', supermarketController.show);
router.put('/supermarkets/:id', supermarketController.update);
router.delete('/supermarkets/:id', supermarketController.delete);

// Filiais
router.post('/branches', branchController.create);
router.get('/branches', branchController.index);
router.get('/branches/:id', branchController.show);
router.put('/branches/:id', branchController.update);
router.delete('/branches/:id', branchController.delete);

// Agências
router.post('/agencies', agencyController.create);
router.get('/agencies', agencyController.index);
router.get('/agencies/:id', agencyController.show);
router.put('/agencies/:id', agencyController.update);
router.delete('/agencies/:id', agencyController.delete);

// Freelancers
router.post('/freelancers', freelancerController.create);
router.get('/freelancers', freelancerController.index);
router.get('/freelancers/:id', freelancerController.show);
router.put('/freelancers/:id', freelancerController.update);
router.delete('/freelancers/:id', freelancerController.delete);

// // Freelancers and Categories
router.get('/freelancers/:id/categories', freelancerController.listCategories);
router.post('/freelancers/:id/categories', freelancerController.addCategory);
router.delete('/freelancers/:id/categories/:category_id', freelancerController.removeCategory);

// Categorias
router.post('/categories', categoryController.create);
router.get('/categories', categoryController.index);
router.get('/categories/:id', categoryController.show);
router.delete('/categories/:id', categoryController.delete);

// Trabalhos (Jobs)
router.post('/jobs', jobController.create);
router.get('/jobs', jobController.index);
router.get('/jobs/:id', jobController.show);
router.put('/jobs/:id', jobController.update);
router.delete('/jobs/:id', jobController.delete);

// // Logs de Jornada
router.get('/logs', jobLogsController.findAll);
router.get('/jobs/:id/logs', jobLogsController.index);
router.get('/freelancers/:id/logs', jobLogsController.findByFreelancer);
router.get('/job_logs/status', jobLogsController.findByStatus);
router.post('/jobs/:id/logs/checkin', jobLogsController.checkIn);
router.post('/jobs/:id/logs/interval', jobLogsController.registerInterval);
router.post('/jobs/:id/logs/checkout', jobLogsController.checkOut);

// Locations
router.post('/freelancer-locations', freelancerLocationController.trackLocation);
router.get('/freelancer-locations', freelancerLocationController.getLatestLocation);
// Exemplo de URL:
// /freelancer-locations?freelancer_id=1&job_id=100
// /freelancer-locations?freelancer_id=1
// /freelancer-locations?job_id=100

// Avaliações
// router.get('/reviews', reviewsController.index);
// router.get('/reviews/:id', reviewsController.show);
// router.get('/freelancers/:id/reviews', reviewsController.index);
// router.post('/jobs/:id/review', reviewsController.create);

// // ----- Finanças:
// Pagamentos
// router.post('/payments', paymentController.create);
// router.get('/payments', paymentController.index);
// router.get('/payments/:id', paymentController.show);
// router.put('/payments/:id/cancel', paymentController.cancel);
// // router.post('/payments/:id/cancel', paymentsController.cancel);
// Requisições/Demandas
router.post('/invoices', invoiceController.create); // Criar uma invoice
router.get('/invoices', invoiceController.index); // Listar invoices
router.get('/invoices/:id', invoiceController.show); // Mostrar invoice por ID
router.delete('/invoices/:id', invoiceController.delete); // Deletar invoice
router.put('/invoices/:id', invoiceController.update); // Atualizar invoice (ex: mudar status de 'pending' para 'paid')
router.get('/invoices/supermarket/:supermarketId', invoiceController.getBySupermarket); // Buscar invoices de um supermercado


// Comissões
// router.post('/commissions', commissionsController.create);
// router.get('/commissions', commissionsController.index);
// router.get('/commissions/:id', commissionsController.show);
// router.put('/commissions/:id', commissionsController.update);

// // Teste api
// router.get('/', (req, res) => {
//   res.send('API funcionando!');
// });

export { router };
