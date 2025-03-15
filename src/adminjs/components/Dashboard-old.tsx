import React, { useEffect, useState } from 'react'
import * as AdminDesignSystem from '@adminjs/design-system';
console.log(AdminDesignSystem);
import { Box, H1, H2, Text } from '@adminjs/design-system'
import { BarChart, Bar, PieChart, Pie, Tooltip, ResponsiveContainer, XAxis, YAxis, Legend, Cell } from 'recharts'
import { ApiClient } from 'adminjs'

interface DashboardData {
  users: number
  supermarkets: number
  agencies: number
  freelancers: number
  jobs: number
  payments: number
  paymentEvolution: { month: string; amount: number }[]
  jobStatusDistribution: { status: string; count: number }[]
}

const COLORS = ['#F2693D', '#F47C53', '#F69669', '#F9B180', '#FBCB96']

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = new ApiClient()
        const { data } = await api.getDashboard()
        console.log('Dados do dashboard:', data) // Debug
        setData(data as DashboardData)
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <Text>Carregando...</Text>
  }

  if (!data) {
    return <Text>Erro ao carregar dados do dashboard.</Text>
  }

  return (
    <Box variant="grey">
      <H1>Dashboard</H1>
      <H2>Resumo</H2>
      <Text>Usuários: {data.users}</Text>
      <Text>Supermercados: {data.supermarkets}</Text>
      <Text>Agências: {data.agencies}</Text>
      <Text>Freelancers: {data.freelancers}</Text>
      <Text>Jobs ativos: {data.jobs}</Text>
      <Text>Total de pagamentos: R$ {data.payments.toFixed(2)}</Text>

      {data.paymentEvolution.length > 0 && (
        <>
          <H2>Evolução de Pagamentos</H2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.paymentEvolution}>
              <XAxis dataKey="month" stroke="#1D2428" />
              <YAxis stroke="#1D2428" />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#F2693D" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {data.jobStatusDistribution.length > 0 && (
        <>
          <H2>Distribuição de Status dos Jobs</H2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.jobStatusDistribution} dataKey="count" nameKey="status" outerRadius={100} label>
                {data.jobStatusDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </>
      )}
    </Box>
  )
}

export default Dashboard




// import React, { useEffect, useState } from 'react';
// // import { Box, H1, H2, Text } from '@adminjs/design-system';
// import { BarChart, Bar, PieChart, Pie, Tooltip, ResponsiveContainer, XAxis, YAxis, Legend, Cell } from 'recharts';
// import { ApiClient, useCurrentAdmin } from 'adminjs'

// interface DashboardData {
//   users: number;
//   supermarkets: number;
//   agencies: number;
//   freelancers: number;
//   jobs: number;
//   payments: number;
//   paymentEvolution: { month: string; amount: number }[];
//   jobStatusDistribution: { status: string; count: number }[];
// }

// const COLORS = ['#F2693D', '#F47C53', '#F69669', '#F9B180', '#FBCB96'];

// const Dashboard: React.FC = () => {
//   const [data, setData] = useState<DashboardData | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetch('/admin/api/dashboard')
//       .then(async (res) => {
//         const json = await res.json();
//         console.log('Dados do dashboard:', json); // Debug
//         setData(json as DashboardData);
//       })
//       .catch((err) => console.error('Erro ao buscar dados do dashboard:', err))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) {
//     return <Text>Carregando...</Text>;
//   }

//   if (!data) {
//     return <Text>Erro ao carregar dados do dashboard.</Text>;
//   }

//   return (
//     <Box variant="grey">
//       <H1>Dashboard</H1>
//       <H2>Resumo</H2>
//       <Text>Usuários: {data.users}</Text>
//       <Text>Supermercados: {data.supermarkets}</Text>
//       <Text>Agências: {data.agencies}</Text>
//       <Text>Freelancers: {data.freelancers}</Text>
//       <Text>Jobs ativos: {data.jobs}</Text>
//       <Text>Total de pagamentos: R$ {data.payments.toFixed(2)}</Text>

//       {Array.isArray(data.paymentEvolution) && data.paymentEvolution.length > 0 ? (
//         <>
//           <H2>Evolução de Pagamentos</H2>
//           <ResponsiveContainer width="100%" height={300}>
//             <BarChart data={data.paymentEvolution}>
//               <XAxis dataKey="month" stroke="#1D2428" />
//               <YAxis stroke="#1D2428" />
//               <Tooltip />
//               <Legend />
//               <Bar dataKey="amount" fill="#F2693D" />
//             </BarChart>
//           </ResponsiveContainer>
//         </>
//       ) : (
//         <Text>Nenhum dado disponível para evolução de pagamentos.</Text>
//       )}

//       {Array.isArray(data.jobStatusDistribution) && data.jobStatusDistribution.length > 0 ? (
//         <>
//           <H2>Distribuição de Status dos Jobs</H2>
//           <ResponsiveContainer width="100%" height={300}>
//             <PieChart>
//               <Pie data={data.jobStatusDistribution} dataKey="count" nameKey="status" outerRadius={100} label>
//                 {data.jobStatusDistribution.map((_, index) => (
//                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                 ))}
//               </Pie>
//               <Tooltip />
//               <Legend />
//             </PieChart>
//           </ResponsiveContainer>
//         </>
//       ) : (
//         <Text>Nenhum dado disponível para status dos jobs.</Text>
//       )}
//     </Box>
//   );
// };

// export default Dashboard;
