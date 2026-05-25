# Base dos Processos do Negócio

## Objetivo

Este documento consolida os atores e processos reais da operação de assistência técnica, suporte e reparo. Ele serve como base para a futura Arquitetura da Informação, copy do sistema, fluxos de interface, regras de negócio e modelagem técnica.

O sistema deve nascer da operação real, e não de módulos genéricos de ERP.

---

# 1. Visão geral da operação

A operação atual é centrada em reparo e suporte de equipamentos eletrônicos, incluindo smartphones, notebooks, desktops, impressoras, tablets, monitores, TVs, placas e outros dispositivos eletrônicos.

O trabalho envolve:

- atendimento inicial ao cliente;
- triagem de viabilidade;
- recebimento ou coleta do equipamento;
- checklist de entrada;
- diagnóstico técnico;
- orçamento;
- aprovação ou recusa do cliente;
- aquisição de peças, insumos ou terceirização;
- execução do reparo;
- testes;
- entrega;
- pagamento;
- garantia;
- pós-venda.

O maior desafio operacional identificado não é apenas técnico. Os principais gargalos estão em:

- controle de andamento;
- comunicação com o cliente;
- controle financeiro;
- controle de prazos;
- organização da bancada;
- registro de custos invisíveis;
- controle de garantias;
- serviços parados;
- priorização.

---

# 2. Atores do sistema

## 2.1 Atendente

### Papel

Responsável por receber, organizar e acompanhar as interações iniciais com clientes e possíveis clientes.

### Objetivo principal

Transformar contatos e intenções em demandas organizadas.

### Responsabilidades

- Receber mensagens, ligações e solicitações presenciais.
- Identificar o cliente.
- Identificar equipamento, marca, modelo e sintoma principal.
- Registrar solicitação inicial.
- Avaliar se o atendimento pode seguir para triagem.
- Informar condições de coleta, entrega, prazos e avaliação.
- Agendar coleta, visita ou recebimento.
- Manter o cliente atualizado.
- Converter atendimento em Ordem de Serviço quando fizer sentido.
- Registrar interações importantes na timeline.

### Necessidades do sistema

- Tela de Atendimentos.
- Cadastro rápido de cliente.
- Cadastro rápido de equipamento e sintoma.
- Status simples de atendimento.
- Histórico de comunicação.
- Mensagens de apoio.
- Lembretes de retorno.
- Conversão de Atendimento em OS.

---

## 2.2 Técnico

### Papel

Responsável pela avaliação técnica, diagnóstico, execução, testes e documentação do serviço.

### Objetivo principal

Resolver tecnicamente o problema com segurança, rastreabilidade e viabilidade.

### Responsabilidades

- Receber o equipamento na bancada.
- Conferir se o equipamento corresponde ao informado pelo cliente.
- Registrar fotos e vídeos de entrada.
- Executar checklist por categoria de equipamento.
- Identificar danos, marcas, desgastes, riscos e falhas aparentes.
- Realizar diagnóstico.
- Registrar evidências técnicas.
- Avaliar viabilidade técnica.
- Identificar peças, insumos, ferramentas ou serviços externos necessários.
- Executar reparo.
- Registrar imprevistos.
- Testar equipamento após reparo.
- Registrar fotos e vídeos de saída.
- Gerar laudo quando necessário.
- Finalizar etapa técnica.

### Necessidades do sistema

- Tela de Bancada.
- Lista de equipamentos sob responsabilidade técnica.
- Checklist por categoria.
- Registro de mídia como evidência.
- Timeline técnica.
- Campo de diagnóstico.
- Campo de pendência atual.
- Controle de peças e insumos.
- Controle de serviços terceirizados.
- Alertas de prazo e serviços parados.

---

## 2.3 Gerente

### Papel

Responsável por controlar operação, dinheiro, prazos, prioridades, risco e desempenho.

### Objetivo principal

Garantir que a operação seja viável, organizada e financeiramente saudável.

### Responsabilidades

- Acompanhar serviços em andamento.
- Identificar serviços atrasados ou parados.
- Definir prioridades.
- Controlar custos de peças, insumos, deslocamento e terceirização.
- Controlar pagamentos, adiantamentos e pendências.
- Controlar garantias.
- Avaliar margem e risco.
- Definir políticas de cobrança.
- Acompanhar produtividade.
- Acompanhar financeiro.
- Acompanhar relacionamento com clientes.

### Necessidades do sistema

- Painel geral.
- Indicadores de serviços pendentes.
- Indicadores de serviços atrasados.
- Controle de custos.
- Controle de recebimentos.
- Controle de adiantamentos.
- Controle de garantias.
- Relatórios operacionais e financeiros.

---

## 2.4 Cliente

### Papel

Pessoa ou empresa que solicita suporte, reparo, diagnóstico, orçamento ou acompanhamento de serviço.

### Objetivo principal

Receber solução, informação clara, prazo, confiança e comprovação do serviço.

### Necessidades do sistema

- Consultar seus dados cadastrados.
- Consultar equipamentos.
- Consultar histórico de serviços.
- Consultar andamento de serviços.
- Consultar orçamento.
- Consultar pagamentos.
- Consultar garantias.
- Acessar documentos e comprovantes.

---

# 3. Processos principais do negócio

## 3.1 Processo de Atendimento Inicial

### Objetivo

Registrar e qualificar uma solicitação antes de assumir compromisso técnico ou comercial.

### Início

O cliente entra em contato por WhatsApp, ligação, indicação ou presencialmente.

### Ações

1. Cumprimentar o cliente.
2. Perguntar o que está acontecendo com o aparelho.
3. Perguntar qual o comportamento atual do equipamento.
4. Identificar categoria, marca e modelo.
5. Identificar sintoma principal.
6. Avaliar se o equipamento está dentro das categorias atendidas.
7. Avaliar prazo esperado pelo cliente.
8. Avaliar viabilidade de coleta, entrega, visita ou recebimento.
9. Registrar atendimento.
10. Decidir próximo passo.

### Decisões possíveis

- Aceitar atendimento.
- Recusar atendimento.
- Terceirizar.
- Agendar.
- Solicitar que o cliente leve o equipamento.
- Solicitar coleta.
- Passar estimativa inicial.
- Encerrar atendimento.

### Critérios de decisão

- Categoria do equipamento.
- Similaridade com serviços já realizados.
- Maquinário disponível.
- Insumos disponíveis.
- Possibilidade de terceirização.
- Prazo exigido pelo cliente.
- Viabilidade financeira.
- Risco do equipamento.
- Perfil do cliente.

### Saída do processo

- Atendimento registrado.
- Atendimento encerrado.
- Atendimento agendado.
- Atendimento convertido em OS.

---

## 3.2 Processo de Recebimento do Equipamento

### Objetivo

Formalizar a entrada do equipamento e proteger a operação contra divergências, danos prévios e conflitos futuros.

### Ações

1. Conferir se o equipamento é o mesmo informado pelo cliente.
2. Verificar integridade física.
3. Confirmar sintomas relatados.
4. Registrar fotos da parte frontal, traseira e superfícies relevantes.
5. Registrar vídeos quando necessário.
6. Verificar partes móveis, portas, encaixes e sinais de uso.
7. Registrar acessórios recebidos.
8. Registrar observações importantes.
9. Informar riscos ao cliente quando necessário.
10. Solicitar autorização para procedimentos com risco.
11. Identificar fisicamente o equipamento.
12. Enviar o equipamento para bancada.

### Informações importantes

- Cliente.
- Telefone.
- Equipamento.
- Marca e modelo.
- Sintoma principal.
- Data de entrada.
- Estado físico.
- Acessórios.
- Riscos identificados.
- Fotos e vídeos.

### Saída do processo

- Equipamento recebido.
- Checklist de entrada iniciado ou concluído.
- Equipamento identificado.
- Equipamento disponível na Bancada.

---

## 3.3 Processo de Bancada e Diagnóstico

### Objetivo

Avaliar o equipamento, entender o problema, determinar viabilidade e preparar orçamento.

### Ações

1. Selecionar equipamento na fila da bancada.
2. Consultar histórico e informações de entrada.
3. Executar checklist técnico por categoria.
4. Realizar testes iniciais.
5. Registrar descobertas.
6. Fotografar ou filmar evidências.
7. Identificar provável causa.
8. Avaliar se há risco de abertura ou desmontagem.
9. Identificar peças, insumos ou ferramentas necessárias.
10. Avaliar possibilidade de terceirização.
11. Definir viabilidade técnica.
12. Definir pendência atual.
13. Preparar informações para orçamento.

### Critérios de viabilidade

- Conhecimento técnico disponível.
- Maquinário disponível.
- Ferramentas disponíveis.
- Peças disponíveis.
- Insumos disponíveis.
- Possibilidade de compra local.
- Possibilidade de compra online.
- Possibilidade de terceirização.
- Prazo aceitável.
- Risco de prejuízo.
- Valor percebido pelo cliente.

### Saída do processo

- Diagnóstico registrado.
- Pendência definida.
- Serviço considerado viável ou inviável.
- Orçamento preparado.
- Laudo preparado, se necessário.

---

## 3.4 Processo de Orçamento

### Objetivo

Compor preço, prazo, garantia e condições comerciais com clareza e segurança.

### Ações

1. Definir mão de obra.
2. Definir valor base por tipo de serviço.
3. Registrar custo de peça.
4. Registrar custo de fornecedor.
5. Registrar taxa de garantia do fornecedor, se houver.
6. Registrar deslocamento para coleta de peça.
7. Registrar deslocamento para coleta ou entrega do equipamento.
8. Registrar insumos.
9. Registrar frete.
10. Registrar terceirização.
11. Definir prazo de execução.
12. Definir prazo de aquisição de peças.
13. Definir tipo de garantia.
14. Definir forma de pagamento.
15. Definir necessidade de adiantamento.
16. Enviar orçamento para aprovação.

### Composição do orçamento

- Mão de obra.
- Peças.
- Insumos.
- Frete.
- Deslocamentos.
- Terceirização.
- Valor base por categoria.
- Margem de risco.
- Garantia.
- Urgência, quando aplicável.

### Regras identificadas

- Mão de obra geral pode partir de valor base.
- Reparo de placa possui valor base específico.
- Equipamentos Apple ou de alto valor podem ter precificação por valor percebido.
- Deslocamento deve ser registrado para evitar prejuízo.
- Peça comprada pelo cliente muda a responsabilidade da garantia.
- Peça comprada pela assistência aumenta responsabilidade operacional.

### Saída do processo

- Orçamento enviado.
- Orçamento aprovado.
- Orçamento recusado.
- Orçamento aguardando cliente.

---

## 3.5 Processo de Aprovação ou Recusa

### Objetivo

Definir o destino do serviço após a decisão do cliente.

### Quando o cliente aprova

1. Registrar aprovação.
2. Registrar forma de pagamento.
3. Registrar adiantamento, se houver.
4. Comprar peça ou aguardar peça do cliente.
5. Registrar custos.
6. Atualizar status da OS.
7. Planejar execução.

### Quando o cliente recusa

1. Registrar recusa.
2. Fechar equipamento.
3. Registrar fotos ou vídeos de fechamento.
4. Informar cliente.
5. Definir retirada ou entrega.
6. Registrar eventual taxa de devolução ou deslocamento.
7. Encerrar OS ou atendimento.

### Saída do processo

- Serviço aprovado e encaminhado para execução.
- Serviço recusado e encaminhado para devolução.

---

## 3.6 Processo de Compra, Peças, Insumos e Terceirização

### Objetivo

Controlar tudo que precisa ser adquirido ou contratado para executar o serviço.

### Ações

1. Identificar item necessário.
2. Consultar fornecedor.
3. Consultar outros técnicos ou sucatas.
4. Comprar localmente ou online.
5. Registrar custo.
6. Registrar prazo de chegada.
7. Registrar deslocamento ou frete.
8. Registrar comprovante.
9. Registrar se foi pago com dinheiro próprio ou adiantamento do cliente.
10. Atualizar pendência do serviço.

### Riscos

- Peça incompatível.
- Peça sem troca.
- Fornecedor não aceitar devolução.
- Dinheiro ficar preso.
- Serviço não ter êxito.
- Cliente cancelar após compra.

### Saída do processo

- Item adquirido.
- Item aguardando chegada.
- Serviço aguardando peça.
- Custo registrado.

---

## 3.7 Processo de Execução do Reparo

### Objetivo

Executar o serviço aprovado com controle técnico, financeiro e documental.

### Ações

1. Confirmar que peças e insumos estão disponíveis.
2. Executar reparo.
3. Registrar etapas importantes.
4. Registrar imprevistos.
5. Registrar custos extras.
6. Atualizar timeline.
7. Realizar testes.
8. Registrar resultado.
9. Atualizar status.

### Saídas possíveis

- Serviço executado com sucesso.
- Serviço parcialmente executado.
- Serviço sem êxito.
- Serviço bloqueado por pendência.
- Serviço encaminhado para terceirização.

---

## 3.8 Processo de Comunicação com Cliente

### Objetivo

Manter o cliente informado, reduzir ansiedade, evitar cobranças e proteger a confiança.

### Eventos que devem gerar comunicação

- Recebimento do equipamento.
- Conclusão da avaliação.
- Envio do orçamento.
- Aprovação do orçamento.
- Compra de peça.
- Chegada de peça.
- Atraso relevante.
- Necessidade de novo prazo.
- Risco identificado.
- Serviço concluído.
- Serviço sem êxito.
- Equipamento pronto para retirada.
- Garantia registrada.

### Necessidades do sistema

- Timeline.
- Histórico de comunicação.
- Lembretes de retorno.
- Alertas de prazo.
- Alerta de cliente sem atualização.
- Mensagens de apoio.
- Portal do cliente.

### Regra importante

O sistema deve ajudar a antecipar atrasos e pendências antes que o cliente precise cobrar.

---

## 3.9 Processo de Entrega

### Objetivo

Finalizar o serviço com pagamento, teste, documentação e garantia.

### Ações

1. Informar cliente sobre conclusão.
2. Confirmar retirada ou entrega.
3. Registrar checklist de saída.
4. Registrar fotos e vídeos finais.
5. Registrar pagamento.
6. Emitir comprovante ou documento.
7. Registrar garantia.
8. Entregar equipamento.
9. Encerrar OS.

### Saída do processo

- Equipamento entregue.
- Pagamento registrado.
- Garantia ativa.
- Serviço finalizado.

---

## 3.10 Processo de Garantia e Pós-venda

### Objetivo

Controlar responsabilidade após a entrega e permitir consulta futura.

### Tipos de garantia

- Garantia de mão de obra.
- Garantia de peça.
- Garantia do fornecedor.
- Garantia parcial.
- Sem garantia para software ou configuração, salvo suporte informal.

### Informações importantes

- Data de compra da peça.
- Prazo de garantia do fornecedor.
- Data de pagamento do cliente.
- Data de retirada ou entrega.
- Tipo de serviço.
- Responsável pela peça.
- Termos aplicáveis.

### Saída do processo

- Garantia ativa.
- Garantia expirada.
- Retorno em garantia.
- Histórico preservado.

---

# 4. Processos de apoio

## 4.1 Controle de Prioridade

A prioridade não é apenas ordem de chegada. Ela considera:

1. Perfil do cliente.
2. Urgência.
3. Tempo de execução.
4. Disponibilidade de peça.
5. Ordem de chegada.
6. Potencial de entrada financeira.
7. Risco de atraso.
8. Serviços parados.

O sistema deve permitir visualizar e reorganizar prioridades.

---

## 4.2 Controle de Serviços Parados

Um serviço pode ficar parado por:

- falta de peça;
- falta de dinheiro;
- falta de ferramenta;
- falta de insumo;
- falta de retorno do cliente;
- excesso de demanda;
- insegurança técnica;
- necessidade de terceirização;
- esquecimento.

O sistema deve destacar:

- dias sem movimentação;
- última atualização;
- próxima ação;
- responsável;
- pendência atual;
- prazo prometido.

---

## 4.3 Controle Financeiro Operacional

O sistema deve controlar:

- mão de obra;
- custo de peça;
- insumos;
- deslocamentos;
- fretes;
- terceirização;
- adiantamentos;
- pagamentos;
- parcelas;
- pendências;
- dinheiro próprio usado no serviço;
- lucro estimado;
- prejuízo assumido.

---

## 4.4 Controle de Risco

Alguns sinais aumentam o risco do atendimento:

- cliente muito exigente com prazo;
- cliente desconfiado;
- equipamento caro ou de luxo;
- serviço fora da estrutura atual;
- necessidade de ferramenta indisponível;
- peça difícil de obter;
- orçamento alto;
- cliente novo;
- baixa margem;
- garantia complexa.

O sistema deve permitir registrar nível de risco ou observações de risco.

---

# 5. Conceitos que devem orientar a Arquitetura da Informação

## Atendimento

Representa a intenção inicial do cliente antes de existir serviço formal.

## Bancada

Representa equipamentos sob responsabilidade técnica, em análise, reparo, teste ou pendência.

## Ordem de Serviço

Representa a formalização do serviço, reunindo cliente, equipamento, orçamento, execução, financeiro e garantia.

## Timeline

Representa a memória operacional do serviço.

## Pendência

Representa o que impede o avanço do serviço no momento.

## Prioridade

Representa a ordem prática de execução considerando contexto técnico, financeiro e relacional.

## Garantia

Representa responsabilidade pós-entrega e deve ser controlada como entidade própria.

---

# 6. Diretriz principal

O sistema deve ser projetado para reduzir dependência da memória, evitar prejuízos invisíveis, melhorar comunicação com cliente e dar clareza sobre o que precisa ser feito agora.

A Arquitetura da Informação deve nascer destes processos.
