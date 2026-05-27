# Bancada, Status e Semântica Operacional

## Objetivo

Documentar a decisão conceitual sobre a tela **Bancada**, a semântica dos status e a relação entre **Cliente**, **Equipamento** e **Serviço**.

Esta decisão existe para evitar confusão entre o status do equipamento e o status do serviço.

---

# Decisão Principal

A **Bancada** será uma visão operacional dos **serviços ativos**, agrupados pelo **status do serviço**.

A Bancada não será uma entidade principal do banco de dados na primeira versão.

```text
Bancada = visão dos serviços abertos organizados por status
```

Cada card da Bancada representa um **Serviço**, mas exibe informações úteis do cliente e do equipamento.

Exemplo de card:

```text
Serviço #SV-024
Samsung A12
Maria Oliveira
Defeito: não carrega
Status: Aguardando
Motivo: Peça
Próxima ação: confirmar chegada do conector
```

---

# Regra Semântica

A regra principal para evitar confusão é:

```text
Cliente é quem.
Equipamento é o quê.
Serviço é o que está acontecendo.
Status é onde o serviço está no fluxo.
Financeiro é o dinheiro movimentado.
```

---

# Cliente, Equipamento e Serviço

## Cliente

Representa quem solicita ou é responsável pelo equipamento.

Exemplos:

- Maria Oliveira;
- Carlos Souza;
- Hamburgueria Norte.

O cliente pode possuir vários equipamentos e vários serviços.

---

## Equipamento

Representa o objeto físico.

Exemplos:

- Samsung A12;
- Notebook Dell 3421;
- Epson TM-T20X.

O equipamento possui dados mais estáveis:

- categoria;
- marca;
- modelo;
- IMEI;
- número de série;
- patrimônio;
- cor;
- acessórios;
- observações técnicas.

O equipamento não deve ser tratado como o centro do andamento operacional.

O equipamento pode aparecer como “aguardando peça” na interface, mas tecnicamente quem está aguardando peça é o **serviço aberto daquele equipamento**.

---

## Serviço

Representa o atendimento técnico, manutenção ou reparo realizado em um equipamento de um cliente.

O serviço é o centro operacional.

O serviço agrupa:

- cliente;
- equipamento;
- defeito informado;
- laudo / avaliação;
- orçamento;
- pagamentos;
- custos;
- garantia;
- status;
- próxima ação;
- histórico.

Sempre que uma informação muda conforme o atendimento avança, ela pertence ao Serviço.

---

# Status Pertence ao Serviço

A decisão mais importante é:

```text
O status pertence ao Serviço, não ao Equipamento.
```

Exemplo incorreto conceitualmente:

```text
Equipamento: Samsung A12
Status: Aguardando peça
```

Forma correta:

```text
Equipamento: Samsung A12
Serviço: Troca de conector de carga
Status do serviço: Aguardando
Motivo de espera: Peça
```

Na interface, o sistema pode exibir de forma simplificada:

```text
Samsung A12 — Maria Oliveira
Aguardando peça
```

Mas internamente essa informação deve vir do serviço ativo.

---

# Bancada como Visão Trello

A Bancada deve funcionar como uma visão parecida com um quadro Trello.

Ela organiza serviços ativos em colunas.

Proposta de colunas:

```text
Entrada
Em avaliação
Orçamento
Aguardando
Em reparo
Em teste
Pronto
```

Essas colunas representam os status operacionais mais úteis para o técnico.

---

# Status Recomendados do Serviço

## Status principais

```text
Entrada
Em avaliação
Orçamento
Aguardando
Em reparo
Em teste
Pronto
Entregue
Cancelado
Garantia
```

## Uso recomendado

### Entrada

Serviço recém-registrado, equipamento recebido ou aguardando triagem inicial.

### Em avaliação

Serviço em diagnóstico, análise, testes iniciais ou elaboração de laudo.

### Orçamento

Serviço com avaliação suficiente para gerar orçamento, orçamento em elaboração ou orçamento enviado ao cliente.

### Aguardando

Serviço parado por depender de alguma condição externa.

Exemplos:

- aprovação do cliente;
- chegada de peça;
- pagamento;
- resposta do cliente;
- serviço de terceiro.

### Em reparo

Serviço aprovado e em execução técnica.

### Em teste

Serviço executado e aguardando validação, teste final ou conferência.

### Pronto

Serviço finalizado e aguardando retirada, entrega ou fechamento.

### Entregue

Equipamento entregue ao cliente e serviço encerrado.

### Cancelado

Serviço interrompido, recusado ou não executado.

### Garantia

Serviço relacionado a retorno de garantia ou análise de garantia.

---

# Motivo de Espera

Para evitar criar status demais, o status **Aguardando** deve possuir um campo complementar chamado **Motivo de espera**.

Motivos recomendados:

```text
Aprovação
Peça
Pagamento
Cliente
Terceiro
Retirada
```

Exemplo:

```text
Status: Aguardando
Motivo de espera: Peça
Próxima ação: confirmar chegada do conector
```

Isso evita criar várias colunas como:

```text
Aguardando aprovação
Aguardando peça
Aguardando pagamento
Aguardando cliente
Aguardando terceiro
```

A Bancada fica mais simples com uma única coluna “Aguardando”, enquanto o motivo aparece dentro do card.

---

# Próxima Ação

A primeira versão não terá sistema de lembretes automáticos.

Para substituir isso de forma simples, o Serviço deve possuir um campo textual chamado **Próxima ação**.

Exemplos:

```text
Comprar conector de carga
Avisar cliente sobre orçamento
Testar após troca da peça
Cobrar sinal
Aguardar retirada
```

Este campo não dispara notificação. Ele apenas ajuda o técnico a entender rapidamente o próximo passo do serviço.

---

# Bancada x Serviços

## Bancada

A Bancada é uma visão operacional.

Serve para responder:

- o que está comigo agora;
- em qual etapa cada serviço está;
- o que está aguardando;
- o que está pronto;
- o que precisa avançar de status.

A Bancada mostra apenas serviços ativos.

---

## Serviços

Serviços é a área completa de consulta e histórico.

Serve para responder:

- quais são todos os serviços;
- quais serviços estão abertos;
- quais foram entregues;
- quais foram cancelados;
- quais possuem garantia;
- qual foi o laudo;
- qual foi o orçamento;
- quais pagamentos e custos estão vinculados.

---

# Exemplo Prático

## Serviço 1

```text
Cliente: Maria Oliveira
Equipamento: Samsung A12
Serviço: Troca de conector de carga
Status: Aguardando
Motivo de espera: Peça
Próxima ação: confirmar chegada do conector
```

Na Bancada:

```text
Coluna: Aguardando
Card: Samsung A12 — Maria Oliveira
Motivo: Peça
```

---

## Serviço 2

```text
Cliente: Carlos Souza
Equipamento: Notebook Dell 3421
Serviço: Diagnóstico de desligamento
Status: Em avaliação
Próxima ação: testar temperatura e fonte
```

Na Bancada:

```text
Coluna: Em avaliação
Card: Notebook Dell 3421 — Carlos Souza
```

---

## Serviço 3

```text
Cliente: Hamburgueria Norte
Equipamento: Epson TM-T20X
Serviço: Manutenção de impressão travando
Status: Pronto
Próxima ação: avisar cliente para retirada
```

Na Bancada:

```text
Coluna: Pronto
Card: Epson TM-T20X — Hamburgueria Norte
```

---

# Diretriz de Implementação

A implementação deve tratar a Bancada como consulta dos serviços ativos agrupados por status.

Exemplo conceitual:

```text
Buscar serviços onde status não está em: Entregue, Cancelado
Agrupar por status
Exibir nas colunas da Bancada
```

Cada card da Bancada deve exibir, no mínimo:

- número do serviço;
- equipamento;
- cliente;
- defeito informado;
- status;
- motivo de espera, quando houver;
- próxima ação.

---

# Resumo da Decisão

- Bancada será mantida.
- Bancada será uma visão operacional estilo Trello.
- Bancada exibirá serviços ativos agrupados por status.
- Status pertence ao Serviço, não ao Equipamento.
- Equipamento é o objeto físico.
- Serviço é o processo acontecendo sobre o equipamento.
- Motivo de espera complementa o status Aguardando.
- Próxima ação substitui lembretes automáticos na primeira versão.
- Sistema de lembretes fica fora do escopo inicial.
