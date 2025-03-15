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

// Definição de relacionamentos
User.hasOne(Supermarket, { foreignKey: 'ownerId', as: 'ownedSupermarket' })
User.hasOne(Agency, { foreignKey: 'ownerId', as: 'ownedAgency' })
User.hasOne(Freelancer, { foreignKey: 'userId', as: 'freelancerProfile' })

Supermarket.hasMany(Branch, { foreignKey: 'supermarketId', as: 'supermarketBranches' })
Supermarket.hasMany(Job, { foreignKey: 'supermarketId', as: 'supermarketJobs' })

Branch.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'parentSupermarket' })
Branch.hasMany(Job, { foreignKey: 'branchId', as: 'branchJobs' })

Agency.hasMany(Freelancer, { foreignKey: 'agencyId', as: 'agencyFreelancers' })

Freelancer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'affiliatedAgency' })
Freelancer.belongsTo(User, { foreignKey: 'userId', as: 'freelancerUser' })
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
Job.hasOne(Review, { foreignKey: 'jobId', as: 'jobReview' })
Job.hasOne(Payment, { foreignKey: 'jobId', as: 'jobPayment' })

JobLog.belongsTo(Job, { foreignKey: 'jobId', as: 'logJob' })
JobLog.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'logFreelancer' })

Review.belongsTo(Job, { foreignKey: 'jobId', as: 'reviewedJob' })
Review.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'reviewedFreelancer' })

Payment.belongsTo(Job, { foreignKey: 'jobId', as: 'paymentJob' })
Payment.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'paymentFreelancer' })

Invoice.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'invoiceSupermarket' })

Commission.belongsTo(Agency, { foreignKey: 'agencyId', as: 'commissionAgency' })

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
}
