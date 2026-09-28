# Marca oficial FitOS — azul e laranja

Fonte: pacote `FitOS_Marca_Proposta_v1(1).zip`, enviado por Murilo em 28/09/2026 e aprovado para implementação pela decisão de produto do EPIC-16 (`FITOS_REQUISITOS_ENTRADA_ONBOARDING_PAGAMENTOS_VISUAL.md`, seção 1 — "prevalecem os requisitos abaixo"). O `LEIA-ME.md` original do pacote identificava a marca como "proposta ainda não aplicada"; este documento registra a aprovação e o mapeamento de uso.

Vetores originais preservados sem redesenho em `public/marca/`.

## Conceito

Um único contorno reúne duas peças em movimento. A passagem diagonal entre elas indica evolução contínua: organização do trabalho do personal e avanço do treino do aluno. Azul noturno transmite estrutura; laranja ilumina o próximo passo.

## Especificação

- Azul noturno: `#101C2C` — já existe como `navy.900` em `M3-DESIGN-TOKENS.md`, sem mudança.
- Laranja: `#FF7847` — novo, substitui `lime` como cor de destaque/primária (ver ADR de ruptura de paleta, a ser criado na FIT-124).
- Fundo claro: `#F5F7F8`.
- Wordmark `FitOS` com contornos vetoriais incorporados ao SVG, sem dependência de fonte externa.
- Ícone: forma única, sem leitura de "E" ou folha. Mesma arte para todos os perfis do produto (Personal, Aluno, Livre).
- Cor nunca é o único sinal de estado da interface (regra já seguida pelo M3 — ex.: `amber`/aviso sempre acompanhado de ícone/rótulo).

## Arquivos e uso (`public/marca/`)

| Contexto | Arquivo | Observação |
| --- | --- | --- |
| Fundo claro | `fitos-horizontal-claro.svg` | PNG (`fitos-horizontal-claro.png`) só quando SVG não for possível |
| Fundo escuro / foto com overlay escuro | `fitos-horizontal-escuro.svg` | Sujeito a conferência de contraste na composição real antes de usar |
| Ícone compacto / superfícies | `fitos-icone.svg` ou `fitos-icone-claro.svg` | Conforme o fundo |
| Favicon | `fitos-favicon.svg` | PNGs 16/24/32/48px como fallback |
| Ícones de app/PWA | `fitos-icone-180px.png` | Demais tamanhos do pacote; gerar outros a partir do SVG se o manifesto exigir |

`fitos-teste-tamanhos.png` é material de referência do pacote (comparação de escala), não um asset de produção.

## Pendências antes de publicação (do próprio pacote de origem)

- Conferir identificação visual e contrastes reais na UI (não só no arquivo isolado).
- Comparação com marcas existentes e eventual busca de disponibilidade de marca — **fora do escopo de engenharia**, responsabilidade de Produto/Jurídico.
- Este documento **não substitui registro de marca**.

## Aplicação obrigatória (EPIC-16 / FIT-124)

`/`, `/entrar`, `/conheca`, `/comecar`, recuperação de acesso, onboardings, checkout, dashboards de Personal/Aluno/Livre, metadados, favicon e PWA. Conferir a nomenclatura clara/escura em renderização real antes de associar automaticamente cada variante ao fundo — nunca declarar a identidade implementada só pela presença dos arquivos no repositório.
