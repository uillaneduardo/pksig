# Requisitos Funcionais do Sistema PKSIG

Este documento mapeia detalhadamente todos os **Requisitos Funcionais (RF)** do sistema PKSIG. Eles descrevem o comportamento esperado e as ações que os usuários podem realizar na plataforma.

---

## Módulo 1: Setup do Sistema e Instalação (WIZ)

*   **RF-1.1: Detecção de Estado Inicial**: O sistema deve identificar na inicialização se possui banco de dados e usuário administrador ativos. Caso contrário, deve redirecionar o usuário obrigatoriamente para a tela `/setup`.
*   **RF-1.2: Escolha de Tecnologia de DB**: O instalador deve oferecer suporte gráfico para parametrização do banco de dados em duas modalidades:
    1.  **SQLite (Local)**: Criação automática de arquivo local `.db` no servidor, ideal para instalação rápida portátil.
    2.  **MySQL / MariaDB (Remoto)**: Configuração de Host, Porta, Nome do Banco, Usuário, Senha e SSL para servidores externos dedicados.
*   **RF-1.3: Conexão e Auto-Reparo**: Durante o setup, o sistema deve fornecer botão para testar a conexão. Ao concluir, deve executar a DDL de instalação (`install.sql`) traduzindo comandos de dialeto MySQL para SQLite automaticamente caso a modalidade SQLite tenha sido escolhida.
*   **RF-1.4: Cadastro do Primeiro Administrador**: No final do assistente de instalação, deve exigir o preenchimento de Nome Completo, Login e Senha para o primeiro administrador administrativo.

---

## Módulo 2: Autenticação e Sessão (AUTH)

*   **RF-2.1: Login de Administrador**: O sistema deve autenticar o usuário com base no nome de usuário (`username`) e senha cadastrados.
*   **RF-2.2: Bloqueio contra Força Bruta**: O backend deve registrar tentativas incorretas na tabela `login_attempts`. Após 5 tentativas consecutivas mal sucedidas para o mesmo usuário dentro de um período de 15 minutos, o acesso temporário deve ser bloqueado por IP ou usuário.
*   **RF-2.3: Persistência Baseada em JWT**: Sessões autorizadas devem utilizar cookies HTTPOnly contendo o Token de Acesso JWT criptografado para garantir segurança nas transações e evitar interceptação externa de cookies de sessão no navegador.
*   **RF-2.4: Log Out Seguro**: O usuário deve ter a opção de encerrar sua sessão a qualquer momento, destruindo o cookie no navegador e invalidando a sessão na tabela `admin_sessions`.

---

## Módulo 3: Gerenciamento de Clientes (CLI)

*   **RF-3.1: Cadastro de Clientes**: O formulário deve permitir o preenchimento de dados de clientes, suportando duas naturezas:
    *   **Pessoa Física (PF)**: Exigindo e validando CPF.
    *   **Pessoa Jurídica (PJ)**: Exigindo Razão Social, CNPJ e Nome do Responsável Técnico.
*   **RF-3.2: Validação de Chaves Únicas**: O sistema não deve permitir o cadastro de dois clientes ativos com o mesmo CPF ou CNPJ.
*   **RF-3.3: Codificação Sequencial Automatizada**: O código do cliente (ex: `CLI-00012`) deve ser gerado sequencialmente através do controle de tabelas de sequências (`sequences`), prevenindo lacunas de IDs ou previsões numéricas.
*   **RF-3.4: Pesquisa Dinâmica**: Deve permitir buscas instantâneas por Nome do Cliente, CPF/CNPJ, E-mail ou Código Sequencial.
*   **RF-3.5: Histórico Centralizado**: Ao abrir o detalhe de um cliente, o sistema deve exibir de forma unificada:
    *   Todos os equipamentos associados ao cliente.
    *   Todas as ordens de serviço ativas e históricas abertas.
    *   O saldo de guias financeiras em aberto ou quitadas.

---

## Módulo 4: Gerenciamento de Equipamentos (EQ)

*   **RF-4.1: Vinculação de Equipamento**: Cada equipamento cadastrado deve estar obrigatoriamente associado a um cliente ativo.
*   **RF-4.2: Especificação Técnica**: O cadastro do equipamento deve incluir:
    *   Categoria do Equipamento (Notebook, Celular, Impressora, etc.).
    *   Marca, Modelo e Cor.
    *   Número de Série (ou IMEI para celulares).
    *   Código de Patrimônio (Tag de Ativo) se aplicável.
*   **RF-4.3: Codificação Única de Ativo**: O sistema deve gerar um código interno sequencial de controle (ex: `EQ-00054`) de forma automatizada no momento da criação.
*   **RF-4.4: Status do Ativo**: Um equipamento deve possuir status parametrizado (Disponível, Em Manutenção, Arquivado ou Descartado).

---

## Módulo 5: Ordens de Serviço (OS)

*   **RF-5.1: Abertura de OS**: O usuário deve abrir uma OS selecionando um Cliente e um Equipamento previamente cadastrados.
*   **RF-5.2: Checklist de Recepção de Balcão**: No ato de recebimento, o técnico deve registrar:
    *   O problema reportado pelo cliente.
    *   Acessórios deixados junto com o hardware (Carregador, Cabo, Bateria, etc.).
    *   Estado estético físico visível (Riscos, trincas, peças soltas).
*   **RF-5.3: Diagnóstico Técnico e Soluções**: A equipe técnica deve preencher:
    *   Defeito técnico constatado na oficina.
    *   Diagnóstico técnico oficial e horas estimadas de serviço.
    *   Peças necessárias ou serviços recomendados.
*   **RF-5.4: Fluxo de Status de OS**: O andamento da OS deve seguir a esteira controlada por IDs ordenados:
    1.  *Recebida* (OS criada)
    2.  *Em análise* (Análise técnica)
    3.  *Aguardando aprovação* (Orçamento pendente de aceite do cliente)
    4.  *Aguardando peça* (Pendente de insumo de fornecedor)
    5.  *Em manutenção* (Reparo ativo)
    6.  *Pronta* (Serviço finalizado)
    7.  *Entregue* (Equipamento retirado)
    8.  *Cancelada* (OS cancelada sem reparo)
*   **RF-5.5: Registro de Histórico de OS**: Toda modificação de status, técnico responsável ou orçamento deve gravar um registro histórico imutável contendo a data, hora, usuário autor da alteração e a descrição do evento.

---

## Módulo 6: Orçamentos, Faturamento e Financeiro (FIN)

*   **RF-6.1: Elaboração do Orçamento da OS**: Permite adicionar linhas de orçamentos discriminadas por Tipo (Peça, Serviço ou Mão de Obra), Quantidade e Valor Unitário.
*   **RF-6.2: Cálculo Automatizado de Totais**: O sistema deve totalizar as linhas de orçamento subtraindo eventuais descontos concedidos ou adicionando taxas tributárias/serviço parametrizadas globais.
*   **RF-6.3: Geração de Guia de Pagamento**: Quando a OS é finalizada ("Pronta"), o sistema deve gerar automaticamente uma Guia de Faturamento base correspondente contendo o valor líquido e as opções de pagamento.
*   **RF-6.4: Controle de Parcelamentos**: Permite o faturamento parcelado da Guia com base em métodos configurados (Ex: PIX: 1x, Cartão: até 12x). O sistema deve criar automaticamente as linhas de parcelas com seus respectivos vencimentos baseados na data base escolhida.
*   **RF-6.5: Fluxo de Transações do Caixa Geral**: Deve permitir o lançamento manual de receitas e despesas correntes não vinculadas diretamente a ordens de serviço (Ex: Aluguel da oficina, despesa de água, etc.) selecionando categorias financeiras apropriadas.
*   **RF-6.6: Fechamento de Caixa Diário**: O sistema deve calcular o fluxo líquido em tempo real de entradas e saídas físicas do caixa da empresa de acordo com os filtros de data aplicados.

---

## Módulo 7: Emissão de Garantias (GAR)

*   **RF-7.1: Geração Automática de Termos de Garantia**: Ao alterar o status de uma OS para "Entregue", o sistema deve gerar automaticamente o certificado sequencial de garantia (ex: `GAR-00210`).
*   **RF-7.2: Cálculo de Vigência da Garantia**: O prazo de expiração (End Date) deve ser calculado dinamicamente somando a quantidade de dias da regra de garantia aplicável à data de entrega física do equipamento.
*   **RF-7.3: Status de Cobertura**: Um certificado deve possuir transição automática de vigência (Vigente, Expirada ou Cancelada) baseada na data atual do servidor.

---

## Módulo 8: Documentação Física e Impressão (A4)

*   **RF-8.1: Impressão de OS Completa**: O sistema deve gerar folha A4 otimizada e formatada contendo os dados do cliente, identificação do equipamento, checklist físico, laudo técnico, orçamento discriminado e termos legais para assinatura física do cliente.
*   **RF-8.2: Impressão de Recibo Financeiro**: Geração de comprovante simplificado A4 de pagamento das parcelas de forma individualizada ou consolidada.
*   **RF-8.3: Impressão do Certificado de Garantia**: Geração de comprovante oficial de garantia contendo cláusulas contratuais e identificação do ativo reparado.
