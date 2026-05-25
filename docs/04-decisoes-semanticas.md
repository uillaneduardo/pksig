# Decisões Semânticas do Sistema

Este documento registra decisões importantes de linguagem, significado e arquitetura da informação do PKSIG.

---

# Diagnóstico e Laudo

## Decisão

Diagnóstico e Laudo não devem ser tratados como entidades operacionais separadas.

O **Diagnóstico** é o registro técnico feito durante a avaliação do equipamento.

O **Laudo** é a versão organizada, impressa ou exportada do Diagnóstico.

---

# Diagnóstico

## O que representa

O Diagnóstico representa aquilo que foi identificado, testado, encontrado ou concluído pelo técnico durante a análise do equipamento.

## Finalidade

- Registrar descobertas técnicas.
- Registrar evidências.
- Organizar pontos encontrados.
- Apoiar o orçamento.
- Apoiar a comunicação com o cliente.
- Servir como base para emissão de Laudo.

## Estrutura sugerida

Um diagnóstico pode conter vários pontos técnicos.

Cada ponto pode conter:

- título do ponto identificado;
- descrição técnica;
- categoria do achado;
- imagem ou vídeo anexo;
- observação do técnico;
- impacto no funcionamento;
- recomendação;
- relação com orçamento, se aplicável.

Exemplo:

```text
Ponto identificado: Conector de carga oxidado
Descrição: Foram encontrados sinais de oxidação nos terminais do conector de carga.
Evidência: foto anexada
Impacto: pode causar falha intermitente no carregamento
Recomendação: substituição do conector
```

---

# Laudo

## O que representa

O Laudo é um documento gerado a partir do Diagnóstico.

Ele deve ser uma saída formatada, com linguagem organizada, layout profissional e possibilidade de impressão.

## Finalidade

- Entregar parecer técnico ao cliente.
- Documentar o estado do equipamento.
- Justificar orçamento.
- Registrar inviabilidade de reparo.
- Comprovar análise técnica.
- Apoiar garantias ou devoluções.

## Características do Laudo

- Layout em A4.
- Papel timbrado.
- Logo da assistência.
- Dados do cliente.
- Dados do equipamento.
- Código da entrada/serviço.
- Data de emissão.
- Diagnóstico organizado.
- Fotos/evidências.
- Conclusão técnica.
- Recomendação.
- Assinatura ou identificação do técnico.

---

# Regra semântica

O usuário não deve precisar “criar um laudo” do zero.

O usuário registra um Diagnóstico e, quando necessário, clica em:

```text
Exportar como Laudo
```

ou

```text
Gerar Laudo em PDF
```

---

# Impacto na Arquitetura da Informação

Na interface, o termo principal deve ser **Diagnóstico**.

O termo **Laudo** deve aparecer como ação, formato de saída ou documento gerado.

Exemplo:

```text
Bancada
 └── Detalhe do equipamento
      └── Diagnóstico
           ├── Pontos identificados
           ├── Evidências
           ├── Conclusão técnica
           └── Gerar Laudo
```

---

# Impacto no sistema

## Entidade principal

- Diagnóstico

## Entidades ou estruturas relacionadas

- Pontos do diagnóstico
- Evidências do diagnóstico
- Documento gerado

## Documento derivado

- Laudo técnico

---

# Diretriz

O Diagnóstico deve ser simples de preencher durante o trabalho técnico.

O Laudo deve ser bonito, organizado e pronto para impressão ou envio ao cliente.
