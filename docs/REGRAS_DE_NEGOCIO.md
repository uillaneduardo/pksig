# Regras de Negócio do Sistema PKSIG

Este documento estabelece as **Regras de Negócio (RN)** aplicadas no ecossistema PKSIG. Estas diretrizes e validações de lógica governam o comportamento dos módulos e a integridade transacional de dados tanto no frontend quanto no backend.

---

## 1. Cadastro e Entidades Base (RN-BASE)

*   **RN-BASE-1: Validação de CPF e CNPJ**:
    *   Para cadastros de clientes Pessoa Física (PF), o CPF fornecido deve conter obrigatoriamente 11 dígitos, passar pela validação matemática padrão de dígitos verificadores e ser limpo de formatações (pontos e traços) no banco.
    *   Para Pessoa Jurídica (PJ), o CNPJ deve conter obrigatoriamente 14 dígitos e passar pela validação matemática oficial de dígitos verificadores.
*   **RN-BASE-2: Unicidade Cadastral**: O sistema rejeita o cadastro de dois clientes ativos com o mesmo CPF ou CNPJ. Clientes inativados não impedem que novos registros utilizem o mesmo CPF/CNPJ.
*   **RN-BASE-3: Exclusão Lógica (Soft Delete)**:
    *   Clientes, Equipamentos e Métodos de Pagamento nunca são removidos fisicamente do banco de dados caso possuam qualquer vínculo transacional (OS, parcelas ou guias). Em vez disso, seu status é alterado para `inativo` (ou equivalente de inatividade).
*   **RN-BASE-4: Geração de Códigos Sequenciais Robustos**: Os códigos sequenciais para Clientes (`CLI-`), Equipamentos (`EQ-`), Ordens de Serviço (`OS-`), Guias de Pagamento (`FAT-`) e Garantias (`GAR-`) devem ser gerados através de controle exclusivo na tabela `sequences` por meio de incrementos atômicos dentro de transações de banco de dados (`SELECT ... FOR UPDATE` ou atualização direta de linha de sequência), evitando duplicidades causadas por concorrência ou falhas de rede.

---

## 2. Fluxo e Transições de Ordens de Serviço (RN-OS)

*   **RN-OS-1: Imutabilidade de Status Concluídos**:
    *   Uma OS com status "Entregue" ou "Cancelada" é considerada um documento histórico imutável. Não é permitido alterar seu orçamento, diagnóstico, técnico responsável ou checklist de recepção após atingir esses status.
*   **RN-OS-2: Bloqueio de Entrega Sem Faturamento**: O status de uma OS não pode ser alterado para "Entregue" caso sua Guia de Faturamento vinculada possua saldo devedor pendente, exceto se o método de pagamento selecionado for uma modalidade faturada a prazo aprovada pelo administrador (ex: Boleto Bancário com faturamento posterior).
*   **RN-OS-3: Registro Obrigatório de Eventos**: Toda transição de status de OS deve registrar obrigatoriamente na tabela de histórico:
    *   ID da OS afetada.
    *   Status de origem e status de destino.
    *   ID do usuário logado que realizou a operação.
    *   Justificativa / Motivo em formato texto (obrigatório se a transição for para "Cancelada").

---

## 3. Gestão Orçamentária e Financeira (RN-FIN)

*   **RN-FIN-1: Cálculo Matemático do Faturamento**:
    O valor total de uma OS é calculado somando-se cada linha de item de orçamento de acordo com a fórmula:
    $$\text{Total OS} = \sum (\text{Quantidade} \times \text{Valor Unitário}) - \text{Desconto Concedido} + \text{Imposto/Taxa Serv.}$$
    *   O desconto máximo permitido não pode ultrapassar o valor acumulado das linhas de "Serviço" e "Mão de Obra". Peças e insumos físicos de reposição não podem ter seu preço de custo reduzido abaixo do valor mínimo.
*   **RN-FIN-2: Geração Automática de Guias**:
    No instante em que a OS é movida para o status "Pronta", o sistema é obrigado a gerar a respectiva Guia de Faturamento (`payment_guides`) com status `Em aberto`.
*   **RN-FIN-3: Divisão Equivalente de Parcelas**:
    Ao optar pelo faturamento a prazo, o montante total da guia é fracionado em $N$ parcelas de acordo com a seguinte regra:
    *   O valor de cada parcela intermediária é calculado como $\text{trunc}(\text{Total} / N, 2)$.
    *   A primeira parcela (ou a última, dependendo da parametrização) deve absorver o resíduo centesimal da divisão matemática para garantir que a soma das parcelas seja rigorosamente igual ao valor da guia.
    *   *Exemplo*: Faturamento de R$ 100,00 em 3 parcelas:
        *   Parcela 1: R$ 33,34 (absorve a diferença de R$ 0,02).
        *   Parcela 2: R$ 33,33.
        *   Parcela 3: R$ 33,33.
        *   Soma Total = R$ 100,00.
*   **RN-FIN-4: Amortização Financeira e Baixa de Guias**:
    *   Quando um pagamento (`payments`) é inserido, o valor pago deve amortizar obrigatoriamente a parcela correspondente de menor vencimento em aberto (`payment_installments`).
    *   Se o valor pago quitar integralmente a parcela, seu status muda para `Pago`.
    *   Se o valor pago liquidar todas as parcelas de uma guia, o status da Guia muda de forma automática para `Quitada`.

---

## 4. Geração de Garantias Contratuais (RN-GAR)

*   **RN-GAR-1: Aplicação das Regras de Vigência**:
    A contagem do período de garantia contratual inicia-se rigorosamente no dia seguinte à data em que a OS foi alterada para "Entregue".
*   **RN-GAR-2: Prioridade de Prazos de Garantia**:
    Para definir o número de dias de cobertura da garantia, o sistema adota as seguintes prioridades:
    1.  *Garantia Customizada*: O número de dias inserido manualmente pelo técnico na OS de forma explícita.
    2.  *Regra por Categoria*: O prazo padrão associado à regra de garantia configurada para a categoria do equipamento reparado (configurada em `warranty_rules`).
    3.  *Garantia Mínima do Sistema*: Prazo geral padrão mínimo de 90 dias (conforme Art. 26, II do CDC para bens duráveis).

---

## 5. Arquitetura PWA e Sincronização Síncrona Offline (RN-PWA)

*   **RN-PWA-1: Resolução de Conflitos Last-Write-Wins**:
    Em cenários de concorrência onde um registro é atualizado offline e modificado simultaneamente no servidor, o sistema adota o padrão *Last-Write-Wins* baseado no carimbo de data/hora (`updated_at`). Caso a diferença temporal de conflito seja crítica ou cause incompatibilidade de integridade, o item falha na sincronização automática e é movido para a fila de `sync_conflicts` para decisão visual manual do operador.
*   **RN-PWA-2: Preservação Cronológica de Transações**:
    A fila de sincronização em segundo plano (`syncQueue`) deve ser consumida e despachada rigorosamente na ordem cronológica de criação dos eventos (`createdAt`), impedindo que uma OS seja criada no servidor antes do cliente vinculado ter sido integrado com sucesso.
*   **RN-PWA-3: Tradução Dinâmica de Chaves Estrangeiras Temporárias**:
    Durante o funcionamento offline, o PWA gera UUIDs temporários para chaves estrangeiras (ex: `client_off_827f`). Ao processar a fila, o sincronizador deve capturar os IDs oficiais retornados pelo banco físico (ex: `clientId: 124`) e substituir dinamicamente todas as referências da fila pendente antes de enviar as requisições subsequentes.
