import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { ApiClient } from 'adminjs';
import { BarChart, Bar, Tooltip, ResponsiveContainer, XAxis, YAxis, Legend } from 'recharts';

const Container = styled.div`
  background: #212529;
  color: #ECEEEF;
  min-height: 100vh;
  padding: 20px;
`;

const Title = styled.h1`
  color: #F2693D;
  text-align: center;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const Card = styled.div`
  background: #333333;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3);
  text-align: center;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: #333333;
  border-radius: 10px;
  overflow: hidden;
`;

const TableHead = styled.thead`
  background: #F2693D;
  color: #fff;
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background: #4D4D4D;
  }
`;

const TableCell = styled.td`
  padding: 10px;
  border-bottom: 1px solid #F69669;
  text-align: center;
`;

interface DashboardData {
  users: number;
  supermarkets: number;
  agencies: number;
  freelancers: number;
  jobs: number;
  payments: number;
  paymentEvolution: { month: string; amount: number }[];
  jobStatusDistribution: { status: string; count: number }[];
}

const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = new ApiClient();
        const { data } = await api.getDashboard();
        setData(data);
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Carregando...</p>;
  if (!data) return <p>Erro ao carregar dados.</p>;

  return (
    <Container>
      <Title>Dashboard</Title>
      
      <Grid>
        <Card><h2>Usuários</h2><p>{data?.users ?? 'N/A'}</p></Card>
        <Card><h2>Supermercados</h2><p>{data?.supermarkets ?? 'N/A'}</p></Card>
        <Card><h2>Agências</h2><p>{data?.agencies ?? 'N/A'}</p></Card>
        <Card><h2>Freelancers</h2><p>{data?.freelancers ?? 'N/A'}</p></Card>
        <Card><h2>Jobs</h2><p>{data?.jobs ?? 'N/A'}</p></Card>
        <Card><h2>Pagamentos</h2><p>R$ {data?.payments?.toFixed(2) ?? '0.00'}</p></Card>
      </Grid>

      {data?.paymentEvolution?.length > 0 && (
        <>
          <h2>Evolução de Pagamentos</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.paymentEvolution}>
              <XAxis dataKey="month" stroke="#ECEEEF" />
              <YAxis stroke="#ECEEEF" />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#F2693D" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {data?.jobStatusDistribution?.length > 0 && (
        <>
          <h2>Status dos Jobs</h2>
          <Table>
            <TableHead>
              <tr>
                <TableCell>Status</TableCell>
                <TableCell>Quantidade</TableCell>
              </tr>
            </TableHead>
            <tbody>
              {data.jobStatusDistribution.map((job, index) => (
                <TableRow key={index}>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.count}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Container>
  );
};

export default Dashboard;
