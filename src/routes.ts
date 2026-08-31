import express from 'express';
import { authController } from './controllers/authController';
import { userController } from './controllers/userController';
import { supermarketController } from './controllers/supermarketController';
import { branchController } from './controllers/branchController';
import { agencyController } from './controllers/agencyController';
import { freelancerController } from './controllers/freelancerController';
import { categoryController } from './controllers/categoryController';
import { jobController } from './controllers/jobController';
import { jobLogsController } from './controllers/jobLogsController';
import { jobPhotoController } from './controllers/jobPhotoController';
import { freelancerLocationController } from './controllers/freelancerLocationController';
import { invoiceController } from './controllers/invoiceController';
import { paymentController } from './controllers/paymentController';
import { withdrawalController } from './controllers/withdrawalController';
import { reviewController } from './controllers/reviewController';
import { orderController } from './controllers/orderController';
import { agencyRateController } from './controllers/agencyRateController';
import { closingController } from './controllers/closingController';
import { billingController } from './controllers/billingController';
import { ensureAuth, authorize } from './middlewares/auth';
import { upload } from './middlewares/upload';

const router = express.Router();

// ----- Autenticação (público) -----
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Leitura pública usada nas telas de cadastro
router.get('/categories', categoryController.index);
router.get('/categories/:id', categoryController.show);
router.get('/agencies', agencyController.index);

// ----- A partir daqui, tudo exige autenticação -----
router.use(ensureAuth);

router.get('/auth/me', authController.me);

// ----- Usuários (admin) -----
router.get('/users', authorize('admin'), userController.index);
router.get('/users/:id', authorize('admin'), userController.show);
router.post('/users', authorize('admin'), userController.create);
router.put('/users/:id', authorize('admin'), userController.update);
router.delete('/users/:id', authorize('admin'), userController.delete);

// ----- Supermercados -----
router.get('/supermarkets', supermarketController.index);
router.get('/supermarkets/:id', supermarketController.show);
router.post('/supermarkets', authorize('supermarket', 'admin'), supermarketController.create);
router.put('/supermarkets/:id', authorize('supermarket', 'admin'), supermarketController.update);
router.delete('/supermarkets/:id', authorize('supermarket', 'admin'), supermarketController.delete);

// ----- Filiais -----
router.get('/branches', branchController.index);
router.get('/branches/:id', branchController.show);
router.post('/branches', authorize('supermarket', 'admin'), branchController.create);
router.put('/branches/:id', authorize('supermarket', 'admin'), branchController.update);
router.delete('/branches/:id', authorize('supermarket', 'admin'), branchController.delete);

// ----- Agências -----
router.get('/agencies/:id', agencyController.show);
router.post('/agencies', authorize('agency', 'admin'), agencyController.create);
router.put('/agencies/:id', authorize('agency', 'admin'), agencyController.update);
router.delete('/agencies/:id', authorize('agency', 'admin'), agencyController.delete);

// ----- Freelancers -----
router.get('/freelancers', freelancerController.index);
router.post('/agency/freelancers', authorize('agency'), freelancerController.createForMyAgency);
router.get('/freelancers/:id', freelancerController.show);
router.post('/freelancers', authorize('agency', 'admin'), freelancerController.create);
router.put('/freelancers/:id', authorize('agency', 'freelancer', 'admin'), freelancerController.update);
router.delete('/freelancers/:id', authorize('agency', 'admin'), freelancerController.delete);
router.get('/freelancers/:id/categories', freelancerController.listCategories);
router.get('/freelancers/:id/reviews', reviewController.getByFreelancerId);
router.post('/freelancers/:id/categories', authorize('agency', 'freelancer', 'admin'), freelancerController.addCategory);
router.delete('/freelancers/:id/categories/:category_id', authorize('agency', 'freelancer', 'admin'), freelancerController.removeCategory);

// ----- Categorias (escrita: admin) -----
router.post('/categories', authorize('admin'), categoryController.create);
router.delete('/categories/:id', authorize('admin'), categoryController.delete);

// ----- Tabela de valor/hora (agência) -----
router.get('/agency/rates', authorize('agency'), agencyRateController.index);
router.post('/agency/rates', authorize('agency'), agencyRateController.create);
router.put('/agency/rates/:id', authorize('agency'), agencyRateController.update);
router.delete('/agency/rates/:id', authorize('agency'), agencyRateController.remove);

// ----- Pedidos (carrinho de vagas do supermercado) -----
router.get('/orders', authorize('supermarket', 'agency', 'admin'), orderController.index);
router.post('/orders', authorize('supermarket'), orderController.create);
router.get('/orders/:id', authorize('supermarket', 'agency', 'admin'), orderController.show);
router.post('/orders/:id/cancel', authorize('supermarket'), orderController.cancel);

// ----- Fechamento mensal (agência fecha o mês de um supermercado) -----
router.get('/closings', authorize('agency', 'supermarket'), closingController.index);
router.get('/closings/preview', authorize('agency'), closingController.preview);
router.post('/closings', authorize('agency'), closingController.create);
router.get('/closings/:id', authorize('agency', 'supermarket', 'admin'), closingController.show);

// ----- Faturamento e relatórios -----
router.get('/billing/summary', authorize('supermarket'), billingController.summary);
router.get('/reports/freelancer', authorize('freelancer'), billingController.freelancerReport);

// ----- Vagas -----
router.get('/jobs', jobController.index);
router.get('/jobs/available', authorize('freelancer'), jobController.available);
router.get('/jobs/live', authorize('agency'), jobController.live);
router.get('/jobs/:id', jobController.show);
router.post('/jobs', authorize('supermarket'), jobController.create);
router.put('/jobs/:id', authorize('supermarket'), jobController.update);
router.delete('/jobs/:id', authorize('supermarket'), jobController.delete);
router.post('/jobs/:id/cancel', authorize('supermarket'), jobController.cancel);
router.post('/jobs/:id/accept', authorize('freelancer'), jobController.accept);
router.post('/jobs/:id/no-show', authorize('agency'), jobController.noShow);
router.post('/jobs/:id/review', authorize('agency'), jobController.review);
router.get('/jobs/:id/review', reviewController.getByJob);

// ----- Logs de jornada -----
router.get('/logs', authorize('admin'), jobLogsController.findAll);
router.get('/jobs/:id/logs', jobLogsController.index);
router.get('/freelancers/:id/logs', jobLogsController.findByFreelancer);
router.get('/job_logs/status', jobLogsController.findByStatus);
router.post('/jobs/:id/logs/checkin', authorize('freelancer'), jobLogsController.checkIn);
router.post('/jobs/:id/logs/interval', authorize('freelancer'), jobLogsController.registerInterval);
router.post('/jobs/:id/logs/checkout', authorize('freelancer'), jobLogsController.checkOut);

// ----- Fotos de comprovação -----
router.get('/jobs/:id/photos', jobPhotoController.listByJob);
router.post('/jobs/:id/photos', authorize('freelancer'), upload.single('photo'), jobPhotoController.upload);

// ----- Localização do freelancer -----
router.post('/freelancer-locations', authorize('freelancer'), freelancerLocationController.trackLocation);
router.get('/freelancer-locations', freelancerLocationController.getLatestLocation);

// ----- Pagamentos -----
router.get('/payments', authorize('admin'), paymentController.index);
router.get('/payments/mine', paymentController.mine);
router.get('/payments/:id', paymentController.show);
router.put('/payments/:id/cancel', authorize('admin'), paymentController.cancel);

// ----- Faturas (supermercado → agência) -----
router.get('/invoices/mine', authorize('supermarket'), paymentController.myInvoices);
router.post('/invoices/:id/pay', authorize('supermarket'), paymentController.invoicePay);
router.get('/invoices', authorize('supermarket', 'admin'), invoiceController.index);
router.get('/invoices/supermarket/:supermarketId', authorize('supermarket', 'admin'), invoiceController.getBySupermarket);
router.get('/invoices/:id', authorize('supermarket', 'admin'), invoiceController.show);
router.post('/invoices', authorize('admin'), invoiceController.create);
router.put('/invoices/:id', authorize('admin'), invoiceController.update);
router.delete('/invoices/:id', authorize('admin'), invoiceController.delete);

// ----- Saques -----
router.post('/withdrawals', authorize('freelancer', 'agency'), withdrawalController.create);
router.get('/withdrawals/mine', authorize('freelancer', 'agency'), withdrawalController.mine);
router.post('/withdrawals/:id/process', authorize('admin'), withdrawalController.process);

export { router };
