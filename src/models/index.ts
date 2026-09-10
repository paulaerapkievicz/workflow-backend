import { User } from './User'
import { Supermarket } from './Supermarket'
import { Agency } from './Agency'
import { Freelancer } from './Freelancer'
import { Category } from './Category'
import { FreelancerCategory } from './FreelancerCategory'
import { Job } from './Job'
import { JobLog } from './JobLog'
import { Review } from './Review'
import { Payment } from './Payment'
import { Invoice } from './Invoice'
import { Commission } from './Commission'
import { Session } from './Session'
import { Branch } from './Branch'
import { FreelancerLocation } from './FreelancerLocation';
import { JobPhoto } from './JobPhoto'
import { Withdrawal } from './Withdrawal'
import { JobShift } from './JobShift'
import { JobShiftBreak } from './JobShiftBreak'
import { SupermarketCategoryRate } from './SupermarketCategoryRate'
import { Order } from './Order'
import { OrderItem } from './OrderItem'
import { SupermarketMember } from './SupermarketMember'
import { SupermarketMemberBranch } from './SupermarketMemberBranch'
import { TeamRole } from './TeamRole'
import { FreelancerContract } from './FreelancerContract'
import { UniformOrder } from './UniformOrder'
import { Invite } from './Invite'
import { AgencyMember } from './AgencyMember'
import { AgencyMemberFreelancer } from './AgencyMemberFreelancer'
import { AgencyMemberBranch } from './AgencyMemberBranch'
import { AgencyMemberPayment } from './AgencyMemberPayment'
import { AgencyMemberJobCredit } from './AgencyMemberJobCredit'
import { InvoiceAdjustment } from './InvoiceAdjustment'
import { ContractTemplate } from './ContractTemplate'
import { FreelancerContractSignature } from './FreelancerContractSignature'
import { JobAlert } from './JobAlert'

// Definição de relacionamentos
User.hasOne(Supermarket, { foreignKey: 'ownerId', as: 'ownedSupermarket' })
User.hasOne(Agency, { foreignKey: 'ownerId', as: 'ownedAgency' })
User.hasOne(Freelancer, { foreignKey: 'userId', as: 'freelancerProfile' })

Supermarket.hasMany(Branch, { foreignKey: 'supermarketId', as: 'supermarketBranches' })
Supermarket.hasMany(Job, { foreignKey: 'supermarketId', as: 'supermarketJobs' })

// Equipe do supermercado (dono + gerentes de loja)
Supermarket.hasMany(SupermarketMember, { foreignKey: 'supermarketId', as: 'members' })
SupermarketMember.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'memberSupermarket' })
SupermarketMember.belongsTo(User, { foreignKey: 'userId', as: 'memberUser' })
User.hasMany(SupermarketMember, { foreignKey: 'userId', as: 'supermarketMemberships' })

// Escopo por filial do gerente (sem linhas = rede toda)
SupermarketMember.hasMany(SupermarketMemberBranch, { foreignKey: 'supermarketMemberId', as: 'memberBranchLinks' })
SupermarketMemberBranch.belongsTo(SupermarketMember, { foreignKey: 'supermarketMemberId', as: 'member' })
SupermarketMemberBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' })

// Cargo configurável da equipe (tag: Administrador, Gerente, RH…)
SupermarketMember.belongsTo(TeamRole, { foreignKey: 'teamRoleId', as: 'teamRole' })
AgencyMember.belongsTo(TeamRole, { foreignKey: 'teamRoleId', as: 'teamRole' })

Branch.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'parentSupermarket' })
Branch.hasMany(Job, { foreignKey: 'branchId', as: 'branchJobs' })

Agency.hasMany(Freelancer, { foreignKey: 'agencyId', as: 'agencyFreelancers' })
Agency.hasMany(Supermarket, { foreignKey: 'agencyId', as: 'agencySupermarkets' })
// Vínculo comercial (cliente), não de posse — a agência que atende este supermercado.
Supermarket.belongsTo(Agency, { foreignKey: 'agencyId', as: 'clientAgency' })
Agency.hasMany(Invite, { foreignKey: 'agencyId', as: 'agencyInvites' })

// Líderes de agência (logins extras com poderes operacionais, sem acesso financeiro)
Agency.hasMany(AgencyMember, { foreignKey: 'agencyId', as: 'agencyMembers' })
AgencyMember.belongsTo(Agency, { foreignKey: 'agencyId', as: 'memberAgency' })
AgencyMember.belongsTo(User, { foreignKey: 'userId', as: 'memberUser' })
User.hasOne(AgencyMember, { foreignKey: 'userId', as: 'agencyMembership' })
AgencyMember.hasMany(AgencyMemberFreelancer, { foreignKey: 'agencyMemberId', as: 'scopeFreelancers' })
AgencyMemberFreelancer.belongsTo(AgencyMember, { foreignKey: 'agencyMemberId', as: 'scopeMember' })
AgencyMemberFreelancer.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'scopedFreelancer' })
AgencyMember.hasMany(AgencyMemberBranch, { foreignKey: 'agencyMemberId', as: 'scopeBranches' })
AgencyMemberBranch.belongsTo(AgencyMember, { foreignKey: 'agencyMemberId', as: 'scopeBranchMember' })
AgencyMemberBranch.belongsTo(Branch, { foreignKey: 'branchId', as: 'scopedBranch' })
AgencyMember.hasMany(AgencyMemberPayment, { foreignKey: 'agencyMemberId', as: 'memberPayments' })
AgencyMemberPayment.belongsTo(AgencyMember, { foreignKey: 'agencyMemberId', as: 'paymentMember' })
AgencyMember.hasMany(AgencyMemberJobCredit, { foreignKey: 'agencyMemberId', as: 'memberJobCredits' })
AgencyMemberJobCredit.belongsTo(AgencyMember, { foreignKey: 'agencyMemberId', as: 'jobCreditMember' })
AgencyMemberJobCredit.belongsTo(Job, { foreignKey: 'jobId', as: 'jobCreditJob' })
AgencyMemberJobCredit.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'jobCreditFreelancer' })

Freelancer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'affiliatedAgency' })
Freelancer.belongsTo(User, { foreignKey: 'userId', as: 'freelancerUser' })
Freelancer.hasOne(FreelancerContract, { foreignKey: 'freelancerId', as: 'contract' })
FreelancerContract.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'contractFreelancer' })
Freelancer.hasMany(UniformOrder, { foreignKey: 'freelancerId', as: 'uniformOrders' })
UniformOrder.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'uniformFreelancer' })
Freelancer.hasMany(Job, { foreignKey: 'freelancerId', as: 'freelancerJobs' })
Freelancer.hasMany(Review, { foreignKey: 'freelancerId', as: 'freelancerReviews' })
Freelancer.hasMany(Payment, { foreignKey: 'freelancerId', as: 'freelancerPayments' })

Category.hasMany(Job, { foreignKey: 'categoryId', as: 'categoryJobs' })
Category.belongsToMany(Freelancer, { through: FreelancerCategory, foreignKey: 'categoryId', as: 'categoryFreelancers' })
Freelancer.belongsToMany(Category, { through: FreelancerCategory, foreignKey: 'freelancerId', as: 'freelancerCategories' })

Job.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'jobSupermarket' })
Job.belongsTo(Branch, { foreignKey: 'branchId', as: 'jobBranch' })
Job.belongsTo(Category, { foreignKey: 'categoryId', as: 'jobCategory' })
Job.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'assignedFreelancer' })
Job.hasMany(JobLog, { foreignKey: 'jobId', as: 'jobLogs' })
// Avaliação da entrega — até uma por autor: a da agência e a do supermercado (cliente).
Job.hasOne(Review, { foreignKey: 'jobId', as: 'jobReview', scope: { authorRole: 'agency' } })
Job.hasOne(Review, { foreignKey: 'jobId', as: 'jobClientReview', scope: { authorRole: 'supermarket' } })
Job.hasMany(Review, { foreignKey: 'jobId', as: 'jobReviews' })
Job.hasOne(Payment, { foreignKey: 'jobId', as: 'jobPayment' })

JobLog.belongsTo(Job, { foreignKey: 'jobId', as: 'logJob' })
JobLog.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'logFreelancer' })

Review.belongsTo(Job, { foreignKey: 'jobId', as: 'reviewedJob' })
Review.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'reviewedFreelancer' })

Payment.belongsTo(Job, { foreignKey: 'jobId', as: 'paymentJob' })
Payment.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'paymentFreelancer' })

Invoice.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'invoiceSupermarket' })
Invoice.belongsTo(Job, { foreignKey: 'jobId', as: 'invoiceJob' })
Invoice.belongsTo(Payment, { foreignKey: 'paymentId', as: 'invoicePayment' })

Job.hasMany(JobShift, { foreignKey: 'jobId', as: 'shifts' })
JobShift.belongsTo(Job, { foreignKey: 'jobId', as: 'shiftJob' })

// Pausas/intervalos dentro de um turno
JobShift.hasMany(JobShiftBreak, { foreignKey: 'jobShiftId', as: 'breaks' })
JobShiftBreak.belongsTo(JobShift, { foreignKey: 'jobShiftId', as: 'breakShift' })
Job.hasMany(JobShiftBreak, { foreignKey: 'jobId', as: 'jobBreaks' })
JobShiftBreak.belongsTo(Job, { foreignKey: 'jobId', as: 'breakJob' })
JobShiftBreak.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'breakFreelancer' })

// Pedidos (carrinho) -> vagas
Order.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'orderSupermarket' })
Order.belongsTo(Branch, { foreignKey: 'branchId', as: 'orderBranch' })
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' })
Order.hasMany(Job, { foreignKey: 'orderId', as: 'orderJobs' })
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'itemOrder' })
OrderItem.belongsTo(Category, { foreignKey: 'categoryId', as: 'itemCategory' })
OrderItem.belongsTo(Branch, { foreignKey: 'branchId', as: 'itemBranch' })
Branch.hasMany(OrderItem, { foreignKey: 'branchId', as: 'branchOrderItems' })
OrderItem.hasMany(Job, { foreignKey: 'orderItemId', as: 'itemJobs' })
Job.belongsTo(Order, { foreignKey: 'orderId', as: 'jobOrder' })
Job.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'jobOrderItem' })

// Tabela de valor/hora por função que a agência cobra de cada supermercado
Supermarket.hasMany(SupermarketCategoryRate, { foreignKey: 'supermarketId', as: 'categoryRates' })
SupermarketCategoryRate.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'rateSupermarket' })
SupermarketCategoryRate.belongsTo(Category, { foreignKey: 'categoryId', as: 'rateCategory' })
SupermarketCategoryRate.belongsTo(Branch, { foreignKey: 'branchId', as: 'rateBranch' })
Category.hasMany(SupermarketCategoryRate, { foreignKey: 'categoryId', as: 'categoryRates' })

// Fatura mensal consolidada (agência -> supermercado)
Invoice.belongsTo(Agency, { foreignKey: 'agencyId', as: 'invoiceAgency' })
Invoice.belongsTo(Branch, { foreignKey: 'branchId', as: 'invoiceBranch' })
Invoice.hasMany(Job, { foreignKey: 'monthlyInvoiceId', as: 'invoiceJobs' })
Job.belongsTo(Invoice, { foreignKey: 'monthlyInvoiceId', as: 'jobMonthlyInvoice' })

// Contestações/abatimentos do fechamento mensal (lançados pelo supermercado, resolvidos pela agência)
Invoice.hasMany(InvoiceAdjustment, { foreignKey: 'invoiceId', as: 'invoiceAdjustments' })
InvoiceAdjustment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'adjustmentInvoice' })
InvoiceAdjustment.belongsTo(User, { foreignKey: 'createdBy', as: 'adjustmentAuthor' })

JobLog.belongsTo(JobShift, { foreignKey: 'jobShiftId', as: 'logShift' })

// Controle de ocorrências (atraso, falta, saída antecipada, turno sem check-out…)
Job.hasMany(JobAlert, { foreignKey: 'jobId', as: 'alerts' })
JobAlert.belongsTo(Job, { foreignKey: 'jobId', as: 'alertJob' })
JobAlert.belongsTo(JobShift, { foreignKey: 'jobShiftId', as: 'alertShift' })
JobAlert.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'alertFreelancer' })

Job.hasMany(JobPhoto, { foreignKey: 'jobId', as: 'jobPhotos' })
JobPhoto.belongsTo(Job, { foreignKey: 'jobId', as: 'photoJob' })
JobPhoto.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'photoFreelancer' })
JobPhoto.belongsTo(JobLog, { foreignKey: 'jobLogId', as: 'photoJobLog' })

Commission.belongsTo(Agency, { foreignKey: 'agencyId', as: 'commissionAgency' })

// Modelo de contrato da agência + assinaturas eletrônicas dos colaboradores
Agency.hasMany(ContractTemplate, { foreignKey: 'agencyId', as: 'contractTemplates' })
ContractTemplate.belongsTo(Agency, { foreignKey: 'agencyId', as: 'templateAgency' })
Freelancer.hasMany(FreelancerContractSignature, { foreignKey: 'freelancerId', as: 'contractSignatures' })
FreelancerContractSignature.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'signatureFreelancer' })
FreelancerContractSignature.belongsTo(Agency, { foreignKey: 'agencyId', as: 'signatureAgency' })
FreelancerContractSignature.belongsTo(ContractTemplate, { foreignKey: 'templateId', as: 'signatureTemplate' })

Session.belongsTo(User, { foreignKey: 'userId', as: 'sessionUser' })

FreelancerLocation.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'freelancer' });
FreelancerLocation.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

export {
  User,
  Supermarket,
  Agency,
  Freelancer,
  Category,
  FreelancerCategory,
  Job,
  JobLog,
  Review,
  Payment,
  Invoice,
  Commission,
  Session,
  Branch,
  FreelancerLocation,
  JobPhoto,
  Withdrawal,
  JobShift,
  JobShiftBreak,
  SupermarketCategoryRate,
  Order,
  OrderItem,
  SupermarketMember,
  SupermarketMemberBranch,
  TeamRole,
  FreelancerContract,
  UniformOrder,
  Invite,
  AgencyMember,
  AgencyMemberFreelancer,
  AgencyMemberBranch,
  AgencyMemberPayment,
  AgencyMemberJobCredit,
  InvoiceAdjustment,
  ContractTemplate,
  FreelancerContractSignature,
  JobAlert,
}
