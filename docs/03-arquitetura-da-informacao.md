# Arquitetura da Informação

## Objetivo

Definir a estrutura de navegação e organização semântica do sistema de assistência técnica, mantendo o sistema simples, prático e alinhado à operação real.

A arquitetura deve evitar módulos pesados de ERP e organizar a informação em torno das entidades básicas do negócio:

```text
Cliente → Equipamento → Serviço
```

O sistema deve ajudar o técnico a responder rapidamente:

- quem é o cliente;
- qual equipamento está sendo atendido;
- qual serviço está em andamento;
- qual é o status atual;
- qual foi o laudo ou avaliação;
- qual orçamento foi aprovado;
- quanto foi pago;
- quais custos existem;
- se existe garantia;
- quais movimentações financeiras foram registradas.

---

# Estrutura Principal

A primeira versão do sistema deve ser organizada com o seguinte menu principal:

- Painel
- Bancada
- Serviços
- Clientes
- Equipamentos
- Financeiro
- Configurações

A área de Agenda/Lembretes fica fora do escopo inicial para reduzir complexidade.

---

# Entidades Principais

## Cliente

Representa quem solicita ou é responsável pelo equipamento.

O cliente agrupa:

- dados de contato;
- equipamentos;
- serviços;
- resumo financeiro vinculado aos serviços.

O cliente responde:

- quem é essa pessoa ou empresa;
- quais equipamentos ela possui;
- quais serviços já realizou;
- se existe alguma pendência financeira.

---

## Equipamento

Representa o objeto físico que recebe manutenção, suporte ou reparo.

O equipamento agrupa:

- cliente vinculado;
- categoria;
- marca;
- modelo;
- IMEI, número de série ou patrimônio;
- observações técnicas;
- histórico de serviços.

O equipamento responde:

- o que é o aparelho;
- de quem é;
- qual identificação possui;
- quais serviços já foram realizados;
- se existe serviço aberto ou garantia associada.

---

## Serviço

Representa o atendimento técnico realizado em um equipamento de um cliente.

O serviço é o centro operacional do sistema.

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

O serviço responde:

- o que está acontecendo com o equipamento;
- qual é o problema informado;
- qual avaliação foi realizada;
- qual orçamento foi aprovado;
- quanto foi pago;
- quais custos foram lançados;
- qual é o resultado financeiro do serviço;
- se existe garantia;
- qual é o status atual.

---

## Movimentação Financeira

Representa qualquer entrada ou saída de valor monetário.

Uma movimentação financeira pode ser:

- entrada;
- saída;
- vinculada a um serviço;
- avulsa.

A movimentação financeira registra:

- tipo: entrada ou saída;
- data e hora;
- valor;
- forma de pagamento;
- categoria;
- descrição;
- vínculo opcional com serviço.

Exemplos:

- entrada vinculada: pagamento de serviço;
- saída vinculada: compra de peça para um serviço;
- saída avulsa: compra de insumo para bancada;
- entrada avulsa: reembolso ou outra entrada não vinculada.

---

# Áreas do Sistema

## Painel

Visão resumida da operação.

Deve mostrar:

- serviços abertos;
- serviços aguardando;
- serviços prontos;
- pagamentos pendentes;
- entradas do período;
- saídas do período;
- resultado financeiro do período.

O Painel responde:

> O que precisa de atenção agora?

---

## Bancada

A Bancada é uma visão operacional dos serviços ativos agrupados pelo status do serviço.

Ela não é uma entidade principal do banco.

A Bancada responde:

- o que está em entrada;
- o que está em avaliação;
- o que está aguardando;
- o que está em reparo;
- o que está em teste;
- o que está pronto para retirada.

Detalhamento completo em: `docs/04-bancada-status-e-semantica.md`.

---

## Serviços

Tela principal de cadastro, consulta e acompanhamento dos serviços.

Deve permitir:

- listar serviços;
- filtrar por status;
- abrir detalhe do serviço;
- registrar laudo / avaliação;
- registrar orçamento;
- registrar pagamentos;
- registrar custos;
- registrar garantia;
- consultar histórico.

---

## Clientes

Tela de relacionamento com o cliente.

Deve permitir:

- listar clientes;
- buscar por nome, telefone ou empresa;
- consultar dados do cliente;
- visualizar equipamentos vinculados;
- visualizar serviços vinculados;
- visualizar resumo financeiro.

---

## Equipamentos

Tela de consulta técnica dos equipamentos.

Deve permitir:

- listar equipamentos;
- buscar por marca, modelo, IMEI, série, patrimônio ou cliente;
- visualizar cliente vinculado;
- visualizar histórico de serviços;
- abrir serviço relacionado.

---

## Financeiro

Tela de movimentações financeiras.

Deve permitir registrar:

- entradas;
- saídas;
- movimentações vinculadas a serviços;
- movimentações avulsas.

Cada movimentação deve possuir:

- data e hora;
- valor;
- forma de pagamento;
- categoria;
- descrição;
- vínculo opcional com serviço.

O Financeiro responde:

- quanto entrou;
- quanto saiu;
- quanto falta receber;
- quais custos foram lançados;
- quais movimentações foram avulsas;
- qual foi o resultado financeiro do período.

---

## Configurações

Área para listas auxiliares e padronização.

Deve incluir:

- categorias de equipamento;
- tipos de serviço;
- status de serviço;
- motivos de espera;
- categorias financeiras;
- formas de pagamento;
- modelos de garantia.

---

# Estrutura e Campos dos Formulários

## Novo Serviço

Formulário principal do sistema.

Representa a entrada operacional de um equipamento para atendimento.

### Estrutura

```text
Novo Serviço

1. Cliente
2. Equipamento
3. Serviço
```

### Campos do Cliente

- buscar cliente existente;
- nome;
- telefone.

### Campos do Equipamento

- categoria;
- marca;
- modelo;
- IMEI / série / patrimônio;
- acessórios recebidos;
- observação física inicial.

### Campos do Serviço

- defeito informado;
- data de entrada;
- status inicial;
- motivo de espera, quando status = Aguardando;
- observações iniciais.

### Ações

- salvar serviço;
- cancelar;
- salvar e abrir detalhe do serviço.

### Resultado esperado

Ao salvar:

- cliente é criado, caso não exista;
- equipamento é criado, caso não exista;
- serviço é criado;
- serviço aparece na Bancada.

---

## Novo Cliente

Formulário auxiliar para relacionamento.

### Campos

- nome;
- telefone / WhatsApp;
- tipo: pessoa física ou empresa;
- e-mail, opcional;
- documento, opcional;
- endereço, opcional;
- observação.

### Ações

- salvar cliente;
- cancelar;
- salvar e adicionar equipamento;
- salvar e criar serviço.

---

## Novo Equipamento

Formulário auxiliar para cadastro técnico.

### Campos

- cliente vinculado;
- categoria;
- marca;
- modelo;
- cor, opcional;
- IMEI / série / patrimônio;
- acessórios;
- observações técnicas.

### Ações

- salvar equipamento;
- cancelar;
- salvar e criar serviço.

---

## Atualizar Status do Serviço

Formulário operacional utilizado para movimentar o serviço na Bancada.

### Campos

- serviço selecionado;
- status;
- motivo de espera, quando status = Aguardando;
- observação da atualização.

### Status disponíveis

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

### Ações

- salvar alteração;
- cancelar.

### Resultado esperado

O serviço muda de coluna na Bancada.

---

## Laudo / Avaliação

Parte interna do Serviço.

### Campos

- defeito informado pelo cliente;
- testes realizados;
- diagnóstico técnico;
- causa provável;
- solução recomendada;
- observações internas.

### Ações

- salvar avaliação;
- salvar e gerar orçamento;
- cancelar.

---

## Orçamento

Parte interna do Serviço.

### Campos

- descrição do serviço;
- mão de obra;
- peças / materiais;
- desconto;
- valor total;
- status do orçamento.

### Status do orçamento

```text
Não enviado
Enviado
Aprovado
Recusado
```

### Ações

- salvar orçamento;
- marcar como aprovado;
- marcar como recusado;
- cancelar.

---

## Nova Movimentação Financeira

Formulário do módulo Financeiro.

### Campos

- tipo: entrada ou saída;
- data;
- hora;
- valor;
- forma de pagamento;
- categoria;
- descrição;
- vínculo: avulsa ou vinculada a serviço;
- serviço vinculado, quando necessário.

### Exemplos

Entrada vinculada:

```text
Pagamento de serviço
```

Saída vinculada:

```text
Compra de peça para serviço
```

Saída avulsa:

```text
Álcool isopropílico
Ferramenta
Frete geral
```

### Ações

- salvar movimentação;
- cancelar.

---

## Configurações

Tela de listas auxiliares.

### Estrutura

```text
Status de serviço
Motivos de espera
Categorias financeiras
Formas de pagamento
Tipos de equipamento
Tipos de serviço
Modelos de garantia
```

### Ações

- adicionar;
- editar;
- desativar;
- reordenar.

---

# Regra Semântica Principal

```text
Cliente é quem.
Equipamento é o quê.
Serviço é o que está acontecendo.
Status é onde o serviço está no fluxo.
Financeiro é o dinheiro movimentado.
```

---

# Diretriz de Escopo Inicial

A primeira versão deve priorizar:

- cadastro e consulta de clientes;
- cadastro e consulta de equipamentos;
- criação e acompanhamento de serviços;
- visão de Bancada por status;
- registro de pagamentos e custos;
- registro de movimentações financeiras avulsas;
- consulta de histórico.

Ficam fora do escopo inicial:

- sistema de lembretes;
- notificações automáticas;
- agenda complexa;
- automações de WhatsApp;
- estoque completo;
- relatórios avançados.
