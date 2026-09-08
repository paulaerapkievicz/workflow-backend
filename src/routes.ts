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
import { closingController } from './controllers/closingController';
import { billingController } from './controllers/billingController';
import { onboardingController } from './controllers/onboardingController';
import { pendingController } from './controllers/pendingController';
import { inviteController } from './controllers/inviteController';
import { invoiceAdjustmentController } from './controllers/invoiceAdjustmentController';
import { agencyMemberController } from './controllers/agencyMemberController';
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
router.get('/invites/:token', inviteController.show);

// Webhook do Mercado Pago (chamado pelo provedor, sem token)
router.post('/payments/mercadopago/webhook', onboardingController.mercadoPagoWebhook);

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
router.post('/agency/supermarkets', authorize('agency'), supermarketController.createForAgency);
router.get('/supermarkets/:id/members', authorize('supermarket', 'agency'), supermarketController.listMembers);
router.post('/supermarkets/:id/members', authorize('supermarket', 'agency'), supermarketController.addMember);
router.put('/supermarket-members/:id', authorize('supermarket', 'agency'), supermarketController.updateMember);
router.delete('/supermarket-members/:id', authorize('supermarket', 'agency'), supermarketController.deleteMember);
router.put('/supermarkets/:id', authorize('supermarket', 'agency', 'admin'), supermarketController.update);
router.delete('/supermarkets/:id', authorize('supermarket', 'agency', 'admin'), supermarketController.delete);
// Valores/hora por função que a agência cobra de cada supermercado (definidos no cadastro do supermercado)
router.get('/supermarkets/:id/rates', authorize('supermarket', 'agency', 'admin'), supermarketController.listRates);
router.post('/supermarkets/:id/rates', authorize('agency', 'admin'), supermarketController.saveRate);
router.put('/supermarkets/:id/rates/:rateId', authorize('agency', 'admin'), supermarketController.updateRate);
router.delete('/supermarkets/:id/rates/:rateId', authorize('agency', 'admin'), supermarketController.removeRate);

// ----- Filiais -----
router.get('/branches', branchController.index);
router.post('/branches/geocode', authorize('supermarket', 'agency', 'admin'), branchController.geocode);
router.get('/branches/:id', branchController.show);
router.post('/branches', authorize('supermarket', 'agency', 'admin'), branchController.create);
router.put('/branches/:id', authorize('supermarket', 'agency', 'admin'), branchController.update);
router.delete('/branches/:id', authorize('supermarket', 'agency', 'admin'), branchController.delete);
router.post('/branches/:id/approve', authorize('agency'), branchController.approve);

// ----- Agências -----
router.get('/agencies/:id', agencyController.show);
router.post('/agencies', authorize('agency', 'admin'), agencyController.create);
router.put('/agencies/:id', authorize('agency', 'admin'), agencyController.update);
router.delete('/agencies/:id', authorize('agency', 'admin'), agencyController.delete);

// ----- Freelancers -----
router.get('/freelancers', authorize('agency', 'leader', 'admin'), freelancerController.index);
router.post('/agency/freelancers', authorize('agency', 'leader'), freelancerController.createForMyAgency);
router.get('/agency/pending-freelancers', authorize('agency', 'leader'), freelancerController.listPendingForMyAgency);
router.post('/agency/freelancers/:id/approve', authorize('agency', 'leader'), freelancerController.approveFreelancer);
router.post('/agency/freelancers/:id/reject', authorize('agency', 'leader'), freelancerController.rejectFreelancer);
router.get('/freelancers/:id', authorize('agency', 'leader', 'freelancer', 'admin'), freelancerController.show);
router.post('/freelancers', authorize('agency', 'admin'), freelancerController.create);
router.put('/freelancers/:id', authorize('agency', 'leader', 'freelancer', 'admin'), freelancerController.update);
router.delete('/freelancers/:id', authorize('agency', 'admin'), freelancerController.delete);
router.get('/freelancers/:id/categories', freelancerController.listCategories);
router.get('/freelancers/:id/reviews', reviewController.getByFreelancerId);
router.get('/freelancers/:id/reputation', authorize('agency', 'leader', 'freelancer', 'admin'), reviewController.reputation);
router.post('/freelancers/:id/categories', authorize('agency', 'leader', 'freelancer', 'admin'), freelancerController.addCategory);
router.put('/freelancers/:id/categories/:category_id', authorize('agency', 'leader', 'admin'), freelancerController.setCategoryRate);
router.delete('/freelancers/:id/categories/:category_id', authorize('agency', 'leader', 'freelancer', 'admin'), freelancerController.removeCategory);

// ----- Categorias (escrita: admin) -----
router.post('/categories', authorize('admin'), categoryController.create);
router.delete('/categories/:id', authorize('admin'), categoryController.delete);

// ----- Configurações da agência -----
router.get('/agency/settings', authorize('agency', 'leader'), agencyController.getSettings);
router.put('/agency/settings', authorize('agency'), agencyController.updateSettings);
router.post('/agency/invites', authorize('agency', 'leader'), inviteController.create);

// ----- Líderes de agência (gestão pelo dono) -----
router.get('/agency/members', authorize('agency'), agencyMemberController.index);
router.post('/agency/members', authorize('agency'), agencyMemberController.create);
router.put('/agency/members/:id', authorize('agency'), agencyMemberController.update);
router.put('/agency/members/:id/scope', authorize('agency'), agencyMemberController.setScope);
router.delete('/agency/members/:id', authorize('agency'), agencyMemberController.remove);
router.post('/agency/members/:id/payments', authorize('agency'), agencyMemberController.registerPayment);
router.get('/agency/member-credits', authorize('agency'), agencyMemberController.jobCredits);
router.post('/agency/member-credits/:id/release', authorize('agency'), agencyMemberController.releaseJobCredit);
router.post('/agency/member-credits/:id/cancel', authorize('agency'), agencyMemberController.cancelJobCredit);
// Carteira do próprio líder
router.get('/leader/wallet', authorize('leader'), agencyMemberController.myWallet);

// ----- Pedidos (carrinho de vagas do supermercado) -----
router.get('/orders', authorize('supermarket', 'agency', 'leader', 'admin'), orderController.index);
router.post('/orders', authorize('supermarket'), orderController.create);
router.get('/orders/:id', authorize('supermarket', 'agency', 'leader', 'admin'), orderController.show);
router.post('/orders/:id/items', authorize('supermarket'), orderController.addItems);
router.post('/orders/:id/approve', authorize('supermarket'), orderController.approve);
router.post('/orders/:id/reject', authorize('supermarket'), orderController.reject);
router.post('/orders/:id/cancel', authorize('supermarket'), orderController.cancel);

// ----- Fechamento mensal (agência fecha o mês de um supermercado) -----
router.get('/closings', authorize('agency', 'supermarket'), closingController.index);
router.get('/closings/preview', authorize('agency'), closingController.preview);
router.post('/closings', authorize('agency'), closingController.create);
router.get('/closings/:id', authorize('agency', 'supermarket', 'admin'), closingController.show);
router.get('/closings/:id/pdf', authorize('agency', 'supermarket', 'admin'), closingController.pdf);

// ----- Faturamento e relatórios -----
router.get('/billing/summary', authorize('supermarket'), billingController.summary);
router.get('/reports/freelancer', authorize('freelancer'), billingController.freelancerReport);

// ----- Onboarding do colaborador (perfil contratual + uniforme) -----
router.get('/freelancer/contract', authorize('freelancer'), onboardingController.getContract);
router.put('/freelancer/contract', authorize('freelancer'), onboardingController.saveContract);
router.get('/freelancer/uniform', authorize('freelancer'), onboardingController.getUniform);
router.post('/freelancer/uniform', authorize('freelancer'), onboardingController.requestUniform);
router.post('/freelancer/uniform/:id/sync', authorize('freelancer'), onboardingController.syncUniform);
router.post('/freelancer/uniform/:id/received', authorize('freelancer'), onboardingController.confirmReceived);
router.post('/freelancer/uniform/:id/selfie', authorize('freelancer'), upload.single('photo'), onboardingController.submitSelfie);
router.post('/freelancer/profile-photo', authorize('freelancer'), upload.single('photo'), freelancerController.uploadProfilePhoto);
router.get('/agency/uniforms', authorize('agency'), onboardingController.listForAgency);
router.get('/agency/pending-counts', authorize('agency', 'leader'), pendingController.agency);
router.get('/supermarket/pending-counts', authorize('supermarket'), pendingController.supermarket);
router.post('/agency/uniforms/:id/ship', authorize('agency'), onboardingController.shipUniform);
router.post('/agency/uniforms/:id/review', authorize('agency'), onboardingController.reviewUniform);

// ----- Vagas -----
router.get('/jobs', jobController.index);
router.get('/jobs/available', authorize('freelancer'), jobController.available);
router.get('/jobs/live', authorize('agency', 'leader', 'supermarket'), jobController.live);
router.get('/jobs/:id', jobController.show);
router.get('/jobs/:id/freelancer-profile', authorize('supermarket'), jobController.freelancerProfile);
router.post('/jobs', authorize('supermarket'), jobController.create);
router.put('/jobs/:id', authorize('supermarket'), jobController.update);
router.put('/agency/jobs/:id', authorize('agency', 'leader'), jobController.updateByAgency);
router.delete('/jobs/:id', authorize('supermarket'), jobController.delete);
router.post('/jobs/:id/cancel', authorize('supermarket'), jobController.cancel);
router.post('/jobs/:id/accept', authorize('freelancer'), jobController.accept);
router.post('/jobs/:id/withdraw', authorize('freelancer'), jobController.withdraw);
router.post('/jobs/:id/release', authorize('agency', 'leader'), jobController.release);
router.get('/agency/pending-settlement', authorize('agency'), jobController.pendingSettlement);
router.post('/jobs/:id/release-payment', authorize('agency'), jobController.releasePayment);
router.post('/jobs/:id/no-show', authorize('agency', 'leader'), jobController.noShow);
router.post('/jobs/:id/force-checkout', authorize('agency', 'leader'), jobController.forceCheckout);
router.post('/jobs/:id/reassign', authorize('agency', 'leader'), jobController.reassign);
router.put('/agency/jobs/:id/timesheet', authorize('agency', 'leader'), jobController.correctTimesheet);
router.post('/agency/jobs/:id/break-start', authorize('agency', 'leader'), jobController.breakStart);
router.post('/agency/jobs/:id/break-end', authorize('agency', 'leader'), jobController.breakEnd);
router.post('/jobs/:id/review', authorize('agency'), jobController.review);
router.post('/jobs/:id/review-by-supermarket', authorize('supermarket'), reviewController.createBySupermarket);
router.get('/jobs/:id/review', reviewController.getByJob);

// ----- Logs de jornada -----
router.get('/logs', authorize('admin'), jobLogsController.findAll);
router.get('/jobs/:id/logs', jobLogsController.index);
router.get('/freelancers/:id/logs', jobLogsController.findByFreelancer);
router.get('/job_logs/status', jobLogsController.findByStatus);
router.post('/jobs/:id/logs/checkin', authorize('freelancer'), jobLogsController.checkIn);
router.post('/jobs/:id/logs/checkout', authorize('freelancer'), jobLogsController.checkOut);
router.post('/jobs/:id/logs/break-start', authorize('freelancer'), jobLogsController.breakStart);
router.post('/jobs/:id/logs/break-end', authorize('freelancer'), jobLogsController.breakEnd);

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
router.post('/invoices/:id/sync-payment', authorize('supermarket'), paymentController.invoiceSyncPayment);
// Contestação/abatimento do fechamento mensal (supermercado lança, agência resolve)
router.get('/invoices/:id/adjustments', authorize('supermarket', 'agency', 'admin'), invoiceAdjustmentController.list);
router.post('/invoices/:id/adjustments', authorize('supermarket'), invoiceAdjustmentController.create);
router.delete('/invoices/:id/adjustments/:adjId', authorize('supermarket'), invoiceAdjustmentController.remove);
router.post('/invoices/:id/adjustments/:adjId/approve', authorize('agency'), invoiceAdjustmentController.approve);
router.post('/invoices/:id/adjustments/:adjId/reject', authorize('agency'), invoiceAdjustmentController.reject);
router.post('/invoices/:id/adjustments/:adjId/revert', authorize('agency'), invoiceAdjustmentController.revert);
router.get('/invoices', authorize('supermarket', 'admin'), invoiceController.index);
router.get('/invoices/supermarket/:supermarketId', authorize('supermarket', 'admin'), invoiceController.getBySupermarket);
router.get('/invoices/:id', authorize('supermarket', 'admin'), invoiceController.show);
router.post('/invoices', authorize('admin'), invoiceController.create);
router.put('/invoices/:id', authorize('admin'), invoiceController.update);
router.delete('/invoices/:id', authorize('admin'), invoiceController.delete);

// ----- Saques -----
router.post('/withdrawals', authorize('freelancer', 'agency', 'leader'), withdrawalController.create);
router.get('/withdrawals/mine', authorize('freelancer', 'agency', 'leader'), withdrawalController.mine);
router.get('/withdrawals', authorize('admin'), withdrawalController.index);
router.post('/withdrawals/:id/process', authorize('admin'), withdrawalController.process);

export { router };
