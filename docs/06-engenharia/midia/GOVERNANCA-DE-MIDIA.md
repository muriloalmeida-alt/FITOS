# Governança de mídia

Adaptado de `docs/06-GOVERNANCA-DE-MIDIA.md` do pacote `FitOS_Pacote_Implementacao_Redesign_MVP_v1` (v1.0, aprovado por Produto, 21/09/2026). Este documento passa a ser a referência canônica do repositório para novos ativos de mídia — o documento original do pacote não é versionado aqui.

## Classificação

| Categoria | Fonte permitida | Uso |
|---|---|---|
| Marca e atmosfera | produção própria, IA aprovada, Pexels/Unsplash licenciado | abertura, marketing e áreas editoriais |
| Foto de aluno | upload do usuário com consentimento | perfil e avatar |
| Exercício | biblioteca comercial validada ou produção própria validada | catálogo e sessão |
| Ícones e Pulso | SVG/componentes próprios | interface |

## Manifesto obrigatório por ativo

Ver `docs/06-engenharia/midia/ASSET-MANIFEST.md` — cada ativo checked-in neste repositório é listado com: identificador, categoria, fonte, autor/gerador, data, licença/escopo, consentimento (quando aplicável), validação técnica (quando exercício), responsável pela aprovação e hash SHA-256 do arquivo.

## Ativos gerados por IA

- Podem ser usados para marca e atmosfera após aprovação de Produto.
- Nunca podem representar aluno real.
- Não embutem texto, logotipo ou UI no bitmap.
- Regeneração recebe novo nome e novo registro — nunca substitui silenciosamente um ativo já aprovado.

## Fallback

- Avatar: iniciais ou avatar neutro.
- Exercício: ilustração/placeholder de grupo muscular com instrução textual.
- Hero: gradiente de marca (tokens `--fitos-color-chrome*`) + `PulseLine` code-native — implementado em `src/shared/ui/AuthHero.tsx`.
