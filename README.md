# Armetec Posts

App (PWA) que gera e posta sozinho os posts do Instagram da Armetec (@armetec.br): **1 post a cada 2 dias**, no formato 4:5 (1080×1350).
Mesma base do Titan Posts, com identidade da Armetec e posts menos padronizados.

## Formatos (misturados no banco)

| `f` no banco | O que sai |
|---|---|
| `institucional` | Carrossel escuro (grade azul, logo 3D): capa + itens numerados + CTA. Ex.: "Prazer, somos a Armetec". |
| `dor` | Carrossel problema → solução: capa clara com a "bagunça", problemas, slide azul com a solução, case opcional e CTA. |
| `mockup` | Foto única clara com computador + celular mostrando uma tela de sistema (`tela`: `financeiro`, `agenda`, `vendas`, `pedidos`, `barbearia`, `site`). |
| `frase` | Foto única com uma frase (`claro: true` para a versão clara). |

Em qualquer título, `<em>texto</em>` fica em azul.

## Arquivos

- `public/slides.js`: desenha todos os formatos no canvas (o mesmo código roda no app e no GitHub Actions).
- `public/index.html`, `style.css`, `app.js`: a tela do app (dias de post, salvar fotos, copiar legenda, ligar a postagem automática).
- `data/banco.json`: o conteúdo. `inicio` é o dia do 1º post, `cadaDias` é o intervalo, `horarios` o horário (de 30 em 30 min).
  O banco atual tem 42 posts (cerca de 84 dias). Para recarregar, adicione itens em `posts`.
- `api/`: login, Redis, conexão com a Meta e publicação (igual ao Titan Posts; agora também publica foto única).
- Para ver as imagens sem postar: `SO_GERAR=1 YMD=2026-11-17 node scripts/postar.mjs` (precisa do `playwright`; salva em `./saida`).

## Colocar no ar

1. **Vercel**: importar este repositório (sem build). Domínio `posts.armetec.com.br`.
2. **Storage**: conectar um banco **Upstash Redis** ao projeto.
3. **Environment Variables**: `AUTH_SECRET`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (mesmas instruções do Titan Posts;
   gere valores novos). Opcional: `SITE_URL` se usar outro domínio, `GITHUB_REPO` se o repositório tiver outro nome.
4. **GitHub** (Settings → Secrets and variables → Actions): segredo `CRON_SECRET` (o mesmo da Vercel) e variável `SITE_URL`.
5. **Instagram**: a conta @armetec.br precisa ser Profissional. No app da Meta, cadastre a URL de retorno
   `https://posts.armetec.com.br/api/ig-callback`, coloque `IG_APP_ID` e `IG_APP_SECRET` na Vercel (ou cole no Jarvis) e,
   no app, sino → Instagram → **Conectar** → **Ligar**. Nada é postado antes de ligar.
6. **Despertador** (recomendado, o agendamento do GitHub atrasa em repositório privado): no cron-job.org, chame a URL do
   despertador a cada 30 min (aparece em `/api/social` → `despertador.url`) e salve um token do GitHub com acesso a Actions
   deste repositório (`ghToken`).

O login do app é o mesmo e-mail e senha do Titan Posts.
Para postar na hora: GitHub → Actions → **Postar no Instagram** → Run workflow → `1`. Se adiantar o post num dia sem post,
ele não se repete no dia dele.
