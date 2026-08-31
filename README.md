# 🚀 WorkFlow - Backend

## 📌 Sobre o Projeto
O **WorkFlow** é uma plataforma de gerenciamento de freelancers para supermercados e agências. O sistema permite que supermercados criem vagas, agências gerenciem freelancers e freelancers se candidatem a trabalhos. Os pagamentos são feitos via plataforma, supermercado/filial paga. Agencia recebe a comissão e o pagamento do freelancer fica liberado para ele. Existe a gestão da parte financeira e contábil. gerenciamento de horários, trabalhos, contratações, relatórios.
 A aplicação conta com um painel administrativo baseado no **AdminJS**, garantindo um gerenciamento eficiente dos dados.

## 🛠️ Tecnologias Utilizadas

### Back-end:
- ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
- ![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white)
- ![Express](https://img.shields.io/badge/-Express-000000?logo=express&logoColor=white)
- ![Sequelize](https://img.shields.io/badge/-Sequelize-52B0E7?logo=sequelize&logoColor=white)
- ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-336791?logo=postgresql&logoColor=white)
- ![AdminJS](https://img.shields.io/badge/-AdminJS-FF4154?logo=&logoColor=white)
- ![JWT](https://img.shields.io/badge/-JWT-000000?logo=jsonwebtokens&logoColor=white)
- ![Bcrypt](https://img.shields.io/badge/-Bcrypt-00BCD4?logo=&logoColor=white)
- ![Express Formidable](https://img.shields.io/badge/-Express%20Formidable-FF69B4?logo=&logoColor=white)

### Dev Tools:
- ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
- ![Sequelize CLI](https://img.shields.io/badge/-Sequelize%20CLI-52B0E7?logo=sequelize&logoColor=white)
- ![TS Node Dev](https://img.shields.io/badge/-TS--Node--Dev-3178C6?logo=ts-node-dev&logoColor=white)

## 📌 Funcionalidades Principais

### 🔹 Autenticação e Segurança
- Registro e login de usuários com **JWT**.
- Controle de acesso baseado em **roles** (Admin, Supermercado, Agência, Freelancer).
- Hash de senhas com **Bcrypt**.

### 🔹 Gestão de Usuários e Perfis
- CRUD de usuários com diferentes permissões.
- Associações entre **supermercados**, **agências** e **freelancers**.

### 🔹 Gerenciamento de Supermercados e Agências
- Cadastro de supermercados e suas **filiais**.
- Cadastro e gerenciamento de **agências** e seus **freelancers**.

### 🔹 Vagas e Trabalho
- Supermercados criam vagas de trabalho para freelancers.
- Agências gerenciam freelancers e os alocam para trabalhos nas vagas criadas.
- Freelancers se candidatam e aceitam vagas disponíveis.

### 🔹 Pagamentos e Faturamento
- Geração de **faturas** para supermercados.
- Processamento de **pagamentos** para freelancers e agências.
- Logs de auditoria para cada transação financeira.

### 🔹 Dashboard Administrativo
- Painel de administração baseado no **AdminJS**.
- Exibição de métricas gerais, gráficos e logs do sistema.

## 🔧 Instalação e Uso

### 📂 Clonando o repositório
```bash
 git clone https://github.com/seu-repositorio/workflow-backend.git
 cd workflow-backend
```

### 📦 Instalando dependências
```bash
 npm install
```

### ⚙️ Configuração do Banco de Dados
Crie um arquivo **.env** e configure os seguintes parâmetros:
```env
DB_HOST=localhost
DB_USER=seu_usuario
DB_PASS=sua_senha
DB_NAME=workflow_db
DB_PORT=5432
JWT_SECRET=sua_chave_secreta
```

### 🚀 Rodando as Migrations e Seeders
```bash
 npx sequelize db:migrate
 npx sequelize db:seed:all
```

### ▶️ Executando o Servidor
```bash
 npm run dev
```
O servidor será iniciado em `http://localhost:3000`

## 📜 Documentação da API
A documentação completa das rotas e endpoints pode ser acessada através do **Postman Collection** `https://red-star-991511.postman.co/workspace/ConnectWork~34ffbd0e-5574-44d1-bd4a-1c3efc118a63/collection/38032474-6e589c0d-06ae-4f6b-90c7-242cddeb2f53?action=share&creator=38032474`