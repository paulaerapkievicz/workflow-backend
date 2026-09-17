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
import { alertController } from './controllers/alertController';
import { inviteController } from './controllers/inviteController';
import { invoiceAdjustmentController } from './controllers/invoiceAdjustmentController';
import { agencyMemberController } from './controllers/agencyMemberController';
import { agencyPartnerController } from './controllers/agencyPartnerController';
import { teamRoleController } from './controllers/teamRoleController';
import { adminAgencyController } from './controllers/adminAgencyController';
import { contractTemplateController } from './controllers/contractTemplateController';
import { contractSignatureController } from './controllers/contractSignatureController';
import { ensureAuth, authorize, ensureCanViewInvoices, ensureCanPayInvoices, requireAgencyFeature, requireLeaderFeature } from './middlewares/auth';
import { upload, uploadDocument } from './middlewares/upload';

const router = express.Router();

// ----- Autenticação (público) -----
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Leitura pública usada nas telas de cadastro
router.get('/categories', categoryController.index);
router.get('/agencies', agencyController.index);
router.get('/invites/:token', inviteController.show);
router.get('/contracts/verify/:id', contractSignatureController.verify);
// Landing pública da agência (/p/:id) — payload whitelisted, sem dado financeiro/privado.
router.get('/agencies/:id/public-landing', agencyController.showPublicLanding);

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

// ----- Agências (admin da plataforma cadastra e gerencia) -----
// Prefixo /platform (não /admin) para não colidir com o painel AdminJS montado em /admin.
router.get('/platform/agencies', authorize('admin'), adminAgencyController.index);
router.post('/platform/agencies', authorize('admin'), adminAgencyController.create);
router.get('/platform/agencies/:id', authorize('admin'), adminAgencyController.show);
router.put('/platform/agencies/:id', authorize('admin'), adminAgencyController.update);

// ----- Supermercados -----
router.get('/supermarkets', authorize('agency', 'leader', 'partner', 'admin'), supermarketController.index);
router.get('/supermarkets/:id', authorize('supermarket', 'agency', 'leader', 'partner', 'admin'), supermarketController.show);
router.post('/supermarkets', authorize('supermarket', 'admin'), supermarketController.create);
router.post('/agency/supermarkets', authorize('agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.createForAgency);
router.post('/supermarkets/:id/reset-password', authorize('agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.resetOwnerPassword);
router.get('/supermarkets/:id/members', authorize('supermarket', 'agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.listMembers);
router.post('/supermarkets/:id/members', authorize('supermarket', 'agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.addMember);
router.put('/supermarket-members/:id', authorize('supermarket', 'agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.updateMember);
router.delete('/supermarket-members/:id', authorize('supermarket', 'agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.deleteMember);
router.post('/supermarket-members/:id/reset-password', authorize('supermarket', 'agency', 'partner'), requireAgencyFeature('clientes'), supermarketController.resetMemberPassword);

// ----- Cargos configuráveis da equipe (supermercado gerencia os seus; agência os dela) -----
router.get('/team-roles', authorize('supermarket', 'agency', 'partner'), teamRoleController.index);
router.post('/team-roles', authorize('supermarket', 'agency', 'partner'), teamRoleController.create);
router.put('/team-roles/:id', authorize('supermarket', 'agency', 'partner'), teamRoleController.update);
router.delete('/team-roles/:id', authorize('supermarket', 'agency', 'partner'), teamRoleController.remove);
router.put('/supermarkets/:id', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.update);
router.delete('/supermarkets/:id', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.delete);
// Perfil institucional do supermercado (dono OU agência-cliente)
router.put('/supermarkets/:id/profile', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.updateProfile);
router.post('/supermarkets/:id/profile/logo', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), upload.single('file'), supermarketController.uploadProfileImage);
router.post('/supermarkets/:id/profile/photo', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), upload.single('file'), supermarketController.uploadProfileImage);
// Ordem personalizada do menu lateral — só o dono da rede
router.put('/supermarket/sidebar-order', authorize('supermarket'), supermarketController.updateSidebarOrder);
// Valores/hora por função que a agência cobra de cada supermercado (definidos no cadastro do supermercado)
router.get('/supermarkets/:id/rates', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.listRates);
router.post('/supermarkets/:id/rates', authorize('agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.saveRate);
router.put('/supermarkets/:id/rates/:rateId', authorize('agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.updateRate);
router.delete('/supermarkets/:id/rates/:rateId', authorize('agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.removeRate);
router.put('/supermarkets/:id/app-payment', authorize('agency', 'partner', 'admin'), requireAgencyFeature('clientes'), supermarketController.setAppPayment);

// ----- Filiais -----
router.get('/branches', authorize('supermarket', 'agency', 'leader', 'partner', 'admin'), branchController.index);
router.post('/branches/geocode', authorize('supermarket', 'agency', 'partner', 'admin'), branchController.geocode);
router.get('/branches/:id', authorize('supermarket', 'agency', 'leader', 'partner', 'admin'), branchController.show);
router.post('/branches', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), branchController.create);
router.put('/branches/:id', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), branchController.update);
router.delete('/branches/:id', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), branchController.delete);
router.post('/branches/:id/approve', authorize('agency', 'partner'), requireAgencyFeature('clientes'), branchController.approve);
// Perfil/dados cadastrais da filial (vazio = herda da matriz)
router.get('/branches/:id/profile', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), branchController.resolvedProfile);
router.put('/branches/:id/profile', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), branchController.updateProfile);
router.post('/branches/:id/profile/logo', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), upload.single('file'), branchController.uploadProfileImage);
router.post('/branches/:id/profile/photo', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('clientes'), upload.single('file'), branchController.uploadProfileImage);

// ----- Agências -----
router.get('/agencies/:id', agencyController.show);
router.post('/agencies', authorize('agency', 'admin'), agencyController.create);
router.put('/agencies/:id', authorize('agency', 'admin'), agencyController.update);
router.delete('/agencies/:id', authorize('agency', 'admin'), agencyController.delete);

// ----- Freelancers -----
router.get('/freelancers', authorize('agency', 'leader', 'partner', 'admin'), freelancerController.index);
router.post('/agency/freelancers', authorize('agency', 'leader', 'partner'), freelancerController.createForMyAgency);
router.get('/agency/pending-freelancers', authorize('agency', 'leader', 'partner'), freelancerController.listPendingForMyAgency);
router.post('/agency/freelancers/:id/approve', authorize('agency', 'leader', 'partner'), freelancerController.approveFreelancer);
router.post('/agency/freelancers/:id/reject', authorize('agency', 'leader', 'partner'), freelancerController.rejectFreelancer);
router.get('/freelancers/:id', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), freelancerController.show);
router.post('/freelancers', authorize('agency', 'partner', 'admin'), requireAgencyFeature('colaboradores'), freelancerController.create);
router.put('/freelancers/:id', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), freelancerController.update);
router.delete('/freelancers/:id', authorize('agency', 'partner', 'admin'), requireAgencyFeature('colaboradores'), freelancerController.delete);
router.post('/freelancers/:id/reset-password', authorize('agency', 'leader', 'partner'), requireAgencyFeature('colaboradores'), freelancerController.resetPassword);
router.get('/freelancers/:id/categories', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), freelancerController.listCategories);
router.get('/freelancers/:id/reviews', authorize('agency', 'leader', 'partner', 'admin'), reviewController.getByFreelancerId);
router.get('/agency/reviews', authorize('agency', 'leader', 'partner'), reviewController.agencyReviews);
router.get('/freelancers/:id/reputation', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), reviewController.reputation);
router.get('/freelancers/:id/leaders', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), freelancerController.leaders);
router.post('/freelancers/:id/categories', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), requireLeaderFeature('valores'), freelancerController.addCategory);
router.put('/freelancers/:id/categories/:category_id', authorize('agency', 'leader', 'partner', 'admin'), requireLeaderFeature('valores'), freelancerController.setCategoryRate);
router.delete('/freelancers/:id/categories/:category_id', authorize('agency', 'leader', 'partner', 'freelancer', 'admin'), requireLeaderFeature('valores'), freelancerController.removeCategory);

// ----- Funções/categorias -----
// Lista completa (com a flag `active`) para a tela de gestão da agência.
router.get('/categories/manage', authorize('admin', 'agency', 'leader', 'partner'), categoryController.manageIndex);
router.get('/categories/:id', categoryController.show);
router.post('/categories', authorize('admin', 'agency', 'partner'), requireAgencyFeature('colaboradores'), categoryController.create);
router.put('/categories/:id', authorize('admin', 'agency', 'partner'), requireAgencyFeature('colaboradores'), categoryController.update);
router.delete('/categories/:id', authorize('admin', 'agency', 'partner'), requireAgencyFeature('colaboradores'), categoryController.delete);

// ----- Configurações da agência -----
router.get('/agency/settings', authorize('agency', 'leader', 'partner'), agencyController.getSettings);
router.put('/agency/settings', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), agencyController.updateSettings);

// ----- Perfil institucional da agência (a própria agência edita) -----
router.get('/agency/profile', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), agencyController.getProfile);
router.put('/agency/profile', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), agencyController.updateProfile);
router.post('/agency/profile/logo', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), upload.single('file'), agencyController.uploadImage);
router.post('/agency/profile/photo', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), upload.single('file'), agencyController.uploadImage);

// ----- Modelos de contrato (agência) -----
router.get('/agency/contract-templates', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.list);
router.post('/agency/contract-templates', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.create);
router.put('/agency/contract-templates/:id', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.update);
router.post('/agency/contract-templates/:id/activate', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.activate);
router.delete('/agency/contract-templates/:id', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.remove);
router.get('/agency/contract-templates/:id/preview', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractTemplateController.preview);

// ----- Assinaturas de contrato -----
router.get('/agency/contract-signatures', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractSignatureController.agencyList);
router.get('/agency/contract-signatures/:id/document', authorize('agency', 'partner'), requireAgencyFeature('configuracoes'), contractSignatureController.agencyDocument);
router.get('/freelancer/contract/agreement', authorize('freelancer'), contractSignatureController.myAgreement);
router.post('/freelancer/contract/sign', authorize('freelancer'), contractSignatureController.sign);
router.get('/freelancer/contract/document', authorize('freelancer'), contractSignatureController.myDocument);
router.post('/agency/invites', authorize('agency', 'leader', 'partner'), inviteController.create);

// ----- Líderes de agência (gestão pelo dono) -----
router.get('/agency/members', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.index);
router.post('/agency/members', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.create);
router.put('/agency/members/:id', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.update);
router.put('/agency/members/:id/scope', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.setScope);
router.delete('/agency/members/:id', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.remove);
router.post('/agency/members/:id/reset-password', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.resetPassword);
router.post('/agency/members/:id/payments', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.registerPayment);
router.get('/agency/member-credits', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.jobCredits);
router.post('/agency/member-credits/:id/release', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.releaseJobCredit);
router.post('/agency/member-credits/:id/cancel', authorize('agency', 'partner'), requireAgencyFeature('equipe'), agencyMemberController.cancelJobCredit);
// Carteira do próprio líder
router.get('/leader/wallet', authorize('leader'), agencyMemberController.myWallet);
router.put('/leader/wallet/pix', authorize('leader'), agencyMemberController.updateOwnPix);

// ----- Sócios de agência (gestão só pelo dono — nunca por outro sócio) -----
router.get('/agency/partners', authorize('agency'), agencyPartnerController.index);
router.post('/agency/partners', authorize('agency'), agencyPartnerController.create);
router.put('/agency/partners/:id', authorize('agency'), agencyPartnerController.update);
router.post('/agency/partners/:id/reset-password', authorize('agency'), agencyPartnerController.resetPassword);
router.delete('/agency/partners/:id', authorize('agency'), agencyPartnerController.remove);

// ----- Pedidos (carrinho de vagas do supermercado) -----
router.get('/orders', authorize('supermarket', 'agency', 'leader', 'partner', 'admin'), orderController.index);
router.post('/orders', authorize('supermarket'), orderController.create);
router.get('/orders/:id', authorize('supermarket', 'agency', 'leader', 'partner', 'admin'), orderController.show);
router.post('/orders/:id/items', authorize('supermarket'), orderController.addItems);
router.post('/orders/:id/approve', authorize('supermarket'), orderController.approve);
router.post('/orders/:id/reject', authorize('supermarket'), orderController.reject);
router.post('/orders/:id/cancel', authorize('supermarket'), orderController.cancel);

// ----- Fechamento mensal (agência fecha o mês de um supermercado) -----
router.get('/closings', authorize('agency', 'partner', 'supermarket'), requireAgencyFeature('financeiro'), ensureCanViewInvoices, closingController.index);
router.get('/closings/preview', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), closingController.preview);
router.post('/closings', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), closingController.create);
router.get('/closings/:id', authorize('agency', 'partner', 'supermarket', 'admin'), requireAgencyFeature('financeiro'), ensureCanViewInvoices, closingController.show);
router.get('/closings/:id/pdf', authorize('agency', 'partner', 'supermarket', 'admin'), requireAgencyFeature('financeiro'), ensureCanViewInvoices, closingController.pdf);

// ----- Faturamento e relatórios -----
router.get('/billing/summary', authorize('supermarket'), ensureCanViewInvoices, billingController.summary);
router.get('/reports/freelancer', authorize('freelancer'), billingController.freelancerReport);
router.get('/reports/freelancer/pdf', authorize('freelancer'), billingController.freelancerReportPdf);
router.get('/freelancer/outcomes', authorize('freelancer'), billingController.freelancerOutcomes);

// ----- Onboarding do colaborador (perfil contratual + uniforme + foto) -----
router.get('/freelancer/contract', authorize('freelancer'), onboardingController.getContract);
router.put('/freelancer/contract', authorize('freelancer'), onboardingController.saveContract);
router.get('/freelancer/uniform', authorize('freelancer'), onboardingController.getUniform);
router.post('/freelancer/uniform', authorize('freelancer'), onboardingController.requestUniform);
router.post('/freelancer/uniform/:id/sync', authorize('freelancer'), onboardingController.syncUniform);
router.post('/freelancer/uniform/:id/received', authorize('freelancer'), onboardingController.confirmReceived);
router.post('/freelancer/profile-photo', authorize('freelancer'), upload.single('photo'), freelancerController.uploadProfilePhoto);
router.get('/agency/uniforms', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), onboardingController.listForAgency);
router.get('/agency/photo-reviews', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), freelancerController.listPhotoReviews);
router.post('/freelancers/:id/photo-review', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), freelancerController.reviewPhoto);
router.get('/agency/pending-counts', authorize('agency', 'leader', 'partner'), pendingController.agency);
router.get('/supermarket/pending-counts', authorize('supermarket'), pendingController.supermarket);
router.post('/agency/uniforms/:id/mark-paid', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), onboardingController.markUniformPaid);
router.post('/agency/uniforms/:id/ship', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), onboardingController.shipUniform);
router.get('/agency/onboarding-reviews', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), onboardingController.listOnboardingReviews);
router.get('/agency/freelancers/:id/contract', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), onboardingController.getContractForAgency);
router.post('/agency/freelancers/:id/onboarding/approve', authorize('agency', 'partner'), requireAgencyFeature('colaboradores'), onboardingController.approveOnboarding);

// ----- Vagas -----
router.get('/jobs', jobController.index);
router.get('/jobs/available', authorize('freelancer'), jobController.available);
router.get('/jobs/live', authorize('agency', 'leader', 'partner', 'supermarket'), jobController.live);
router.get('/jobs/:id', jobController.show);
router.get('/jobs/:id/freelancer-profile', authorize('supermarket'), jobController.freelancerProfile);
router.post('/jobs', authorize('supermarket'), jobController.create);
router.put('/jobs/:id', authorize('supermarket'), jobController.update);
router.put('/agency/jobs/:id', authorize('agency', 'leader', 'partner'), requireLeaderFeature('horarios'), jobController.updateByAgency);
router.delete('/jobs/:id', authorize('supermarket'), jobController.delete);
router.post('/jobs/:id/cancel', authorize('supermarket'), jobController.cancel);
router.post('/jobs/:id/accept', authorize('freelancer'), jobController.accept);
router.post('/jobs/:id/withdraw', authorize('freelancer'), jobController.withdraw);
router.post('/jobs/:id/release', authorize('agency', 'leader', 'partner'), jobController.release);
router.post('/agency/jobs/close-expired-unfilled', authorize('agency', 'leader', 'partner'), jobController.closeExpiredUnfilled);
router.post('/agency/jobs/:id/close-unfilled', authorize('agency', 'leader', 'partner'), jobController.closeUnfilled);
router.get('/agency/pending-settlement', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), jobController.pendingSettlement);
router.post('/jobs/:id/release-payment', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), jobController.releasePayment);
router.post('/jobs/:id/no-show', authorize('agency', 'leader', 'partner'), jobController.noShow);
router.post('/jobs/:id/force-checkout', authorize('agency', 'leader', 'partner'), jobController.forceCheckout);
router.post('/jobs/:id/reassign', authorize('agency', 'leader', 'partner'), jobController.reassign);
router.put('/agency/jobs/:id/timesheet', authorize('agency', 'leader', 'partner'), requireLeaderFeature('horarios'), jobController.correctTimesheet);
router.post('/agency/jobs/:id/break-start', authorize('agency', 'leader', 'partner'), requireLeaderFeature('horarios'), jobController.breakStart);
router.post('/agency/jobs/:id/break-end', authorize('agency', 'leader', 'partner'), requireLeaderFeature('horarios'), jobController.breakEnd);
router.post('/jobs/:id/review', authorize('agency'), jobController.review);
router.post('/jobs/:id/review-by-supermarket', authorize('supermarket'), reviewController.createBySupermarket);
router.get('/jobs/:id/review', authorize('agency', 'leader', 'partner', 'admin', 'supermarket'), reviewController.getByJob);

// ----- Alertas de ocorrência nas vagas (atraso, falta, saída antecipada…) -----
router.get('/alerts', authorize('agency', 'leader', 'partner', 'supermarket'), alertController.list);
router.get('/alerts/summary', authorize('agency', 'leader', 'partner', 'supermarket'), alertController.summary);
router.post('/alerts/:id/acknowledge', authorize('agency', 'leader', 'partner'), alertController.acknowledge);
router.post('/alerts/:id/resolve', authorize('agency', 'leader', 'partner'), alertController.resolve);
router.post('/internal/alerts/sweep', authorize('admin'), alertController.sweep);

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
router.get('/payments/mine', authorize('freelancer', 'agency', 'partner', 'supermarket', 'admin'), paymentController.mine);
router.get('/payments/:id', authorize('freelancer', 'agency', 'partner', 'supermarket', 'admin'), paymentController.show);
router.put('/payments/:id/cancel', authorize('admin'), paymentController.cancel);

// ----- Faturas (supermercado → agência) -----
router.get('/invoices/mine', authorize('supermarket'), ensureCanViewInvoices, paymentController.myInvoices);
router.post('/invoices/:id/pay', authorize('supermarket'), ensureCanPayInvoices, paymentController.invoicePay);
router.post('/invoices/:id/sync-payment', authorize('supermarket'), ensureCanPayInvoices, paymentController.invoiceSyncPayment);
router.post('/invoices/:id/mark-paid', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), paymentController.invoiceMarkPaid);
// Comprovante de pagamento manual (supermercado anexa, agência confere)
router.post('/invoices/:id/payment-proof', authorize('supermarket'), ensureCanPayInvoices, uploadDocument.single('file'), paymentController.submitPaymentProof);
router.post('/invoices/:id/payment-proof/approve', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), paymentController.approvePaymentProof);
router.post('/invoices/:id/payment-proof/reject', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), paymentController.rejectPaymentProof);
// Contestação/abatimento do fechamento mensal (supermercado lança, agência resolve)
router.get('/invoices/:id/adjustments', authorize('supermarket', 'agency', 'partner', 'admin'), requireAgencyFeature('financeiro'), ensureCanViewInvoices, invoiceAdjustmentController.list);
router.post('/invoices/:id/adjustments', authorize('supermarket'), ensureCanPayInvoices, invoiceAdjustmentController.create);
router.delete('/invoices/:id/adjustments/:adjId', authorize('supermarket'), ensureCanPayInvoices, invoiceAdjustmentController.remove);
router.post('/invoices/:id/adjustments/:adjId/approve', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), invoiceAdjustmentController.approve);
router.post('/invoices/:id/adjustments/:adjId/reject', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), invoiceAdjustmentController.reject);
router.post('/invoices/:id/adjustments/:adjId/revert', authorize('agency', 'partner'), requireAgencyFeature('financeiro'), invoiceAdjustmentController.revert);
router.get('/invoices', authorize('supermarket', 'admin'), ensureCanViewInvoices, invoiceController.index);
router.get('/invoices/supermarket/:supermarketId', authorize('supermarket', 'admin'), ensureCanViewInvoices, invoiceController.getBySupermarket);
router.get('/invoices/:id', authorize('supermarket', 'admin'), ensureCanViewInvoices, invoiceController.show);
router.post('/invoices', authorize('admin'), invoiceController.create);
router.put('/invoices/:id', authorize('admin'), invoiceController.update);
router.delete('/invoices/:id', authorize('admin'), invoiceController.delete);

// ----- Saques -----
router.post('/withdrawals', authorize('freelancer', 'agency', 'leader'), withdrawalController.create);
router.get('/withdrawals/mine', authorize('freelancer', 'agency', 'leader'), withdrawalController.mine);
router.get('/withdrawals', authorize('admin'), withdrawalController.index);
router.post('/withdrawals/:id/process', authorize('admin'), withdrawalController.process);

export { router };
