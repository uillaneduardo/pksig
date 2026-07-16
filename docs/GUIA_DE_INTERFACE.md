# Guia de Interface e Design do PKSIG

Este guia estabelece os padrões visuais, de layout, componentes e acessibilidade aplicados em todas as telas e elementos de interface do **PKSIG**. Ele assegura consistência visual e usabilidade ideal, tanto em computadores desktop quanto em dispositivos móveis ou na impressão de guias em folha A4.

---

## 1. Identidade Visual e Cores

O PKSIG adota um estilo **Profissional Limpo**, focado em altíssimo contraste, uso generoso de espaços negativos e componentes utilitários sóbrios.

### Paleta de Cores Mestre (Tailwind CSS v4)

*   **Fundo Principal (Canvas)**: Fundo suave off-white (`bg-slate-50` / `#f8fafc`) para reduzir a fadiga ocular em uso contínuo diário.
*   **Texto Principal (Dark Charcoal)**: Cinza profundo de alta legibilidade (`text-slate-900` / `#0f172a`) para títulos e corpo.
*   **Texto Secundário**: Cinza médio (`text-slate-500` / `#64748b`) para status secundários, legendas e textos de apoio.
*   **Cor de Destaque (Brand Accent)**: Azul corporativo sóbrio (`text-sky-600` / `bg-sky-600` / `#0284c7`) para botões de ação principal, seleções ativas e indicadores chave.
*   **Indicadores de Estado (Feedback)**:
    *   *Sucesso*: Verde esmeralda (`bg-emerald-500` / `text-emerald-700`) para status Pago, Ativo, Concluído.
    *   *Alerta / Pendência*: Âmbar quente (`bg-amber-500` / `text-amber-700`) para Aguardando Peça ou Orçamento Pendente.
    *   *Erro / Perigo*: Vermelho carmim (`bg-rose-600` / `text-rose-700`) para Cancelado, Excluído, Vencido ou campos com erros de validação.

---

## 2. Tipografia e Escrita

O sistema utiliza exclusivamente a fonte **Inter** para interfaces funcionais e **JetBrains Mono** para dados estruturados, códigos de identificação e indicadores numéricos.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Escalas de Texto:
-   **Títulos de Seção / Páginas**: `font-sans font-bold tracking-tight text-slate-900 text-2xl` (ou `text-xl` em celulares).
-   **Rótulos de Campos (Labels)**: `font-sans font-medium text-slate-700 text-xs tracking-wide uppercase`.
-   **Textos de Tabela e Formulários**: `font-sans font-normal text-slate-800 text-sm`.
-   **Códigos e Valores Monetários**: `font-mono font-medium tracking-tight text-slate-900 text-sm`.

---

## 3. Diretrizes de Layout e Espaçamento

O ritmo visual é gerado através de variações intencionais de margens e preenchimentos (paddings) para que a tela pareça humana e organizada, nunca mecânica ou atulhada de dados.

-   **Margem Externa de Conteúdo**: `px-4 sm:px-6 lg:px-8 py-6` para assegurar respiro lateral consistente em telas de qualquer proporção.
-   **Cartões de Conteúdo (Cards)**: Devem possuir cantos ligeiramente arredondados (`rounded-xl`), bordas finas e sutis (`border border-slate-100`) e sombra delicada (`shadow-sm`) sobre o fundo cinza.
-   **Espaçamento entre Linhas de Formulários**: Utilizar `space-y-4` para agrupar campos e `grid grid-cols-1 md:grid-cols-3 gap-4` para distribuições em colunas no desktop.

---

## 4. Componentes de Interface Padrão

### 4.1. Botões (Buttons)
Todos os botões possuem borda com cantos arredondados suavizados (`rounded-lg`), transição suave de cor (`transition-colors duration-200`) e foco visível para navegação por teclado.

*   **Ação Primária (Aprovar, Salvar, Criar)**: Fundo colorido sólido com alto contraste (`bg-sky-600 hover:bg-sky-700 text-white`).
*   **Ação Secundária (Voltar, Cancelar Edição, Fechar)**: Borda fina e fundo neutro (`border border-slate-200 bg-white hover:bg-slate-50 text-slate-700`).
*   **Ação de Destruição (Excluir, Cancelar OS)**: Fundo vermelho em alto contraste (`bg-rose-600 hover:bg-rose-700 text-white`).

### 4.2. Campos de Entrada (Inputs)
*   **Estados do Input**:
    *   *Padrão*: `border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500`.
    *   *Inativo / Desabilitado*: `bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100`.
    *   *Com Erro*: `border-rose-500 focus:ring-rose-500/20 focus:border-rose-500`.

---

## 5. Padrões de Layout Responsivo (Mobile vs Desktop)

-   **Touch Targets (Mobile)**: Botões, inputs e abas devem possuir altura mínima de `44px` no celular para cliques confortáveis com o polegar.
-   **Tabelas de Dados**: Em telas pequenas (`max-width: 640px`), tabelas complexas devem se comportar como "cartões empilháveis" (cards), em vez de forçar o surgimento de barra de rolagem horizontal desconfortável.
-   **Menu de Navegação**:
    *   *Desktop*: Barra lateral compacta esquerda com ícones Lucide e texto explicativo.
    *   *Celular*: Barra de abas fixas na parte inferior da tela (Bottom Navigation) com acesso direto aos 4 módulos críticos (OS, Clientes, Financeiro, Mais/Configurações).

---

## 6. Layout e Padrões de Impressão A4

A impressão física de ordens de serviço, recibos e certificados de garantia é crucial para assistências técnicas. O sistema adota uma folha de estilo de impressão integrada `@media print`:

-   **Ocultar Elementos de Tela**: Menus de navegação, botões de ação ("Salvar", "Excluir"), barras de status PWA e rodapés do sistema são ocultados na impressão (`print:hidden`).
-   **Reset de Cores**: O fundo cinza off-white do canvas é forçado para branco absoluto e todo o texto é convertido para preto sólido para economizar tinta de impressora e garantir máxima legibilidade (`print:bg-white print:text-black`).
-   **Sem Quebras de Páginas Inconvenientes**: Tabelas e blocos de diagnósticos técnicos utilizam regras CSS de interrupção de página controlada (`print:break-inside-avoid`) para evitar que uma assinatura ou tabela de orçamento seja cortada ao meio entre duas folhas.
-   **Formatação de Via Dupla**: Para checklists de recepção rápida, o sistema formata a folha A4 em duas vias idênticas recortáveis divididas por uma linha tracejada sutil (`print:border-dashed`).
-   **Layout de Grade Limpo**: Uso de bordas finas sólidas de cinza médio para formatar tabelas de faturamento e checklists na via impressa do cliente.
