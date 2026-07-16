# Fluxos do Sistema PKSIG

Este documento mapeia visual e funcionalmente os principais **Fluxos do Sistema**, detalhando como os dados se movem e as mudanças de estado que ocorrem durante o ciclo operacional do PKSIG.

---

## 1. Fluxo de Entrada e Abertura de OS

Este fluxo descreve o recebimento do equipamento no balcão de atendimento.

```text
 [Início]
    │
    ▼
[Pesquisar Cliente] ──(Não Encontrado?)──► [Cadastrar Cliente PF/PJ]
    │                                             │
    ├────────────────◄────────────────────────────┘
    ▼
[Pesquisar Ativo] ──(Não Encontrado?)──► [Vincular Novo Equipamento]
    │                                             │
    ├────────────────◄────────────────────────────┘
    ▼
[Abrir Ordem de Serviço]
    │
    ├─► Preencher problema reportado
    ├─► Selecionar Acessórios deixados (Checklist)
    └─► Registrar Estado Físico Exterior do Equipamento
    │
    ▼
[Salvar OS] ──► Status: "Recebida" (Código OS-XXXXX gerado)
    │
    ▼
[Imprimir Via de Recepção (A4)] (Opcional, assinado pelo cliente)
```

---

## 2. Fluxo de Diagnóstico, Orçamento e Execução

Representa a fase interna realizada na bancada técnica de manutenção.

```text
Status: "Recebida"
    │
    ▼
[Mover para: "Em análise"]
    │
    ▼
[Avaliação Física e de Hardware]
    │
    ├─► Técnico identifica componentes defeituosos
    └─► Preenche Defeito Constatado e Diagnóstico Técnico
    │
    ▼
[Elaborar Orçamento da OS]
    │
    ├─► Inserir Linhas de Peças
    ├─► Inserir Linhas de Serviços e Mão de Obra
    └─► Aplicar descontos / taxas aplicáveis
    │
    ▼
[Mover para: "Aguardando aprovação"]
    │
    ▼
[Contato com o Cliente]
    │
    ├─► (Rejeitado) ──► [Mover para: "Cancelada"] ──► Registrar Motivo
    │
    └─► (Aprovado) ──► [Mover para: "Em manutenção"] (Início do conserto)
                           │
                           ▼
                      [Execução do Reparo]
                           │
                           ▼
                      [Mover para: "Pronta"] ──► (Gera Guia Financeira)
```

---

## 3. Fluxo de Faturamento e Recebimento Financeiro

Governa a fase de entrega do equipamento e faturamento do serviço.

```text
Status da OS: "Pronta"
    │
    ▼
[Carregar Guia de Faturamento Automatizada]
    │
    ▼
[Escolher Método de Faturamento]
    │
    ├─► (À Vista: Dinheiro / PIX / Débito)
    │      │
    │      ▼
    │   [Registrar Pagamento Único] ──► Quita a Guia Financeira
    │
    └─► (A Prazo: Parcelamento no Crédito / Boleto)
           │
           ▼
        [Gerar Grade de Parcelas] ──► Registrar Datas e Valores
           │
           ▼
        [Realizar Baixa Parcial / Total das Parcelas]
```

---

## 4. Fluxo de Entrega Física e Emissão de Garantias

Encerramento completo do ciclo de atendimento do cliente.

```text
Guia Financeira: "Quitada" ou "Faturada a Prazo"
    │
    ▼
[Mover OS para: "Entregue"]
    │
    ▼
[Geração Automática de Certificado de Garantia (GAR-XXXXX)]
    │
    ├─► Captura as Regras de Vigência
    └─► Calcula a data limite de cobertura baseada nos dias de garantia
    │
    ▼
[Imprimir Recibo de Entrega e Termo de Garantia (A4)]
    │
    ▼
 [Fim do Ciclo]
```

---

## 5. Fluxo de Sincronização Offline-First (PWA)

Detala o comportamento assíncrono inteligente quando o sistema opera sem internet.

```text
[Dispositivo Técnico Offline]
    │
    ├─► Criação de Cliente ──► Gerado ID Temporário (client_off_123)
    ├─► Criação de Ativo   ──► Salvo no Cache Local IndexedDB (Dexie)
    └─► Grava Evento no "syncQueue" (Status: "pending")
    │
[Detecta Conexão de Rede Ativa ("Online")]
    │
    ▼
[Dispara Motor de Sincronização Síncrona]
    │
    ▼
[Processar Item 1: Criar Cliente]
    │
    ├─► Envia requisição POST com Chave de Idempotência
    ├─► Servidor registra no MySQL/SQLite físico e retorna ID Real (clientId: 98)
    └─► [Mapeamento PWA] ──► Grava relação "client_off_123" -> 98
    │
    ▼
[Processar Item 2: Vincular Equipamento]
    │
    ├─► [Resolvedor de Dependências PWA] ──► Substitui client_id temporário pelo Real (98)
    ├─► Envia requisição POST ao servidor e obtém ID Real do Equipamento
    └─► Deleta itens processados da fila "syncQueue" com sucesso
    │
    ▼
[Sincronização Completa] ──► Atualiza data-hora mestre "last_sync_at"
```
