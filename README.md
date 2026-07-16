# PK SIG — Sistema de Gerenciamento de Ordens de Serviço (OS)

PK SIG é um sistema web full-stack de alto desempenho para gerenciamento de ordens de serviço, clientes, equipamentos e finanças de assistências técnicas. Projetado para ser robusto, rápido e flexível, ele suporta bancos de dados relacionais **MySQL/MariaDB** e bancos de dados locais **SQLite**, além de contar com um assistente inteligente de instalação automática, diagnóstico e autocorreção de integridade.

---

## 🚀 Principais Funcionalidades

### 📋 Gerenciamento de Ordens de Serviço (OS)
- Ciclo de vida completo das ordens de serviço (Recebida, Em análise, Aguardando peça, Em manutenção, Pronta, Entregue, Cancelada).
- Associação rápida a clientes e equipamentos com códigos gerados automaticamente de forma segura e sequencial.
- Checklist de estado do equipamento e acessórios recebidos no balcão de atendimento.
- Detalhamento de diagnóstico técnico, peças necessárias, tempo estimado e observações adicionais.

### 👥 Cadastro de Clientes e Equipamentos
- Cadastro completo de pessoas físicas (PF) e jurídicas (PJ) com validações de CPF/CNPJ.
- Histórico de equipamentos associados a cada cliente, com marca, modelo, número de série e rastreamento por tags de ativos.

### 💰 Gestão Financeira Completa
- Orçamentos integrados a cada OS contendo detalhamento de serviços, peças, quantidades e valores.
- Registro automatizado de entradas e saídas financeiras categorizadas.
- Lançamento de parcelamentos, fluxo de caixas diário, métodos de pagamento flexíveis (PIX, Crédito, Débito, Dinheiro, Boleto).
- Emissão de termos de garantia e regras de garantia personalizáveis por OS.

### ⚙️ Flexibilidade de Banco de Dados e Auto-Reparo (Integridade)
- **Suporte Híbrido**: Funciona com **MySQL/MariaDB** para servidores de nuvem de produção e **SQLite** local para implantações simplificadas sem infraestrutura complexa.
- **Auto-Reparo de Integridade (Self-Healing Schema)**: A cada inicialização, o sistema realiza testes de consistência física e de estrutura do banco de dados de acordo com o arquivo mestre `install.sql`. Se faltarem tabelas ou colunas específicas (como novos campos de PWA ou tabelas de idempotência), o sistema as restaura e popula dados mestres de forma totalmente automática.
- **Assistente de Instalação (Setup Wizard)**: Interface amigável passo a passo para testar a conexão com o banco de dados, criar o banco automaticamente, verificar a compatibilidade e configurar o administrador do sistema no primeiro acesso.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, Recharts (Gráficos), Motion (Animações).
- **Backend**: Node.js com Express e TypeScript (`tsx`).
- **Drivers de Banco de Dados**: `mysql2` para MySQL/MariaDB e `node:sqlite` para SQLite síncrono ultra veloz.
- **Validação de Dados**: Zod.
- **Autenticação e Segurança**: JWT, bcryptjs para criptografia de senhas, e criptografia simétrica para chaves de acesso armazenadas localmente.

---

## 📦 Como Instalar e Rodar o Projeto

1. **Instalar Dependências**:
   ```bash
   npm install
   ```

2. **Configuração de Ambiente**:
   O sistema possui um assistente automático na interface do usuário. Não é necessário criar arquivos de configuração de banco manualmente.
   No entanto, você pode duplicar o arquivo de variáveis de exemplo caso precise expor portas específicas:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```

4. **Primeiro Acesso (Wizard)**:
   Abra o seu navegador no endereço indicado (porta `3000`). Você será automaticamente redirecionado para o assistente de configuração visual, onde poderá escolher entre instalar no SQLite local (arquivo `pksig.db`) ou conectar ao seu servidor MySQL/MariaDB remoto.

---

## 📂 Estrutura de Arquivos

- `/server.ts` — Ponto de entrada do backend Express, APIs do sistema e controle de rotas.
- `/src/lib/database.ts` — Abstração de banco de dados unificada (`DatabaseDriver`, `SqliteDriver`, `MySqlDriver`) e motor de auto-reparo e verificação de integridade estrutural.
- `/database/install.sql` — Esquema oficial mestre (DDL) de instalação do banco de dados, contendo tabelas, índices e sementes iniciais de dados estáticos do sistema.
- `/database/seed.sql` — Dados de demonstração opcionais para testes integrados.
- `/src/` — Código frontend em React contendo componentes modulares, páginas de dashboards de finanças, gerenciamento de ordens de serviço, clientes e configurações.

---

## 🛡️ Autocorreção de Banco de Dados e Segurança

Para proteger contra perda de dados ou scripts mal executados em versões legadas:
- O sistema verifica todas as tabelas em tempo de inicialização.
- Campos de PWA e IDs de parcelamentos são criados via comandos de `ALTER TABLE` incrementais em tempo real se não forem encontrados.
- A integridade física (`PRAGMA integrity_check`) é executada no SQLite para garantir a saúde dos dados gravados localmente no container.
