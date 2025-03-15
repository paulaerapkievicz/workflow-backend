import AdminJS, { PageHandler } from 'adminjs'
import { sequelize } from '../database'
import { User, Supermarket, Agency, Freelancer, Job, Payment } from '../models'

export const dashboardOptions: {
  handler?: PageHandler
  component?: string
} = {
  component: AdminJS.bundle('../adminjs/components/Dashboard'),
  handler: async (req, res, context) => {
    try {
      // Executa todas as queries em paralelo para otimizar a performance
      const [
        users,
        supermarkets,
        agencies,
        freelancers,
        jobs,
        payments,
        paymentEvolution,
        jobStatusDistribution
      ] = await Promise.all([
        User.count(),
        Supermarket.count(),
        Agency.count(),
        Freelancer.count(),
        Job.count(),
        Payment.sum('amount').then(sum => sum ?? 0), // Garante que não seja null ou undefined
        
        // Query para evolução de pagamentos nos últimos 6 meses
        Payment.findAll({
          attributes: [
            [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('created_at')), 'month'],
            [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'amount']
          ],
          group: ['month'],
          order: [['month', 'ASC']],
          limit: 6
        }).then(results => results.map(row => ({
          month: ((row.getDataValue('month') as unknown) as string) ?? '',
          amount: parseFloat(((row.getDataValue('amount') as unknown) as string | number)?.toString() ?? '0')
        }))),

        // Query para distribuição de status dos jobs
        Job.findAll({
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          group: ['status']
        }).then(results => results.map(row => ({
          status: ((row.getDataValue('status') as unknown) as string) ?? 'unknown',
          count: parseInt(((row.getDataValue('count') as unknown) as string | number)?.toString() ?? '0', 10)
        })))
      ])

      res.json({
        users,
        supermarkets,
        agencies,
        freelancers,
        jobs,
        payments,
        paymentEvolution,
        jobStatusDistribution
      })
    } catch (error) {
      console.error('❌ Erro ao carregar dados do dashboard:', error)

      res.status(500).json({
        error: 'Erro ao carregar dashboard',
        details: (error as Error).message // Garante que `error` tem `message`
      })
    }
  }
}

// import AdminJS from 'adminjs';
// import { ActionRequest, ActionResponse } from 'adminjs';
// import { sequelize } from '../database';

// export const dashboardOptions = {
//   component: AdminJS.bundle('./components/Dashboard.tsx'),
//   handler: async (req: ActionRequest, res: ActionResponse) => {
//     const queries = {
//       users: 'SELECT COUNT(*) AS count FROM users',
//       supermarkets: 'SELECT COUNT(*) AS count FROM supermarkets',
//       agencies: 'SELECT COUNT(*) AS count FROM agencies',
//       freelancers: 'SELECT COUNT(*) AS count FROM freelancers',
//       jobs: 'SELECT COUNT(*) AS count FROM jobs',
//       payments: 'SELECT SUM(amount) AS total FROM payments'
//     };

//     try {
//       const results = await Promise.all(
//         Object.entries(queries).map(async ([key, query]) => {
//           const [data]: any = await sequelize.query(query);
//           return { [key]: data[0]?.count || data[0]?.total || 0 };
//         })
//       );

//       res.json(Object.assign({}, ...results));
//     } catch (error) {
//       console.error('Erro ao buscar métricas do dashboard:', error);
//       res.json({ error: 'Erro ao carregar dashboard' });
//     }
//   }
// };
