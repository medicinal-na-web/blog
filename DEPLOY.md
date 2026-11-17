# Deploy do blog — blog.medicinalnaweb.com.br

O blog é um site Next.js que lê o conteúdo direto do Supabase do blog
(projeto `blog_medicinalnaweb`). Não depende mais do CMS da Brasa
(`cms.brasa.tech`).

## De onde vem cada dado

| Dado | Origem |
| --- | --- |
| Artigos, produtos, categorias, tags | Supabase (`articles`, `products`, `categories`, `product_categories`, `article_tags`), só o que está publicado |
| Layout das páginas (home, blog, campanhas, sobre etc.), menu, rodapé, configurações do site | `src/data/cms/*.json`, exportado do CMS antigo em 17/11/2026 |

Publicar ou editar um artigo no Supabase aparece no site em até 1 minuto
(cache ISR de 60 s). Mudar layout ou configurações = editar o JSON e fazer
novo deploy.

## Deploy na VPS (Docker)

Pré-requisitos na VPS: Docker com o plugin compose e um proxy reverso com HTTPS
(Caddy, Nginx, Traefik ou o que já atende o n8n).

```bash
git clone https://github.com/medicinal-na-web/blog.git
cd blog
cp .env.example .env      # preencher SUPABASE_ANON_KEY (chave pública) e demais valores
docker compose up -d --build
```

O container fica em `127.0.0.1:3000`. No proxy reverso, aponte
`blog.medicinalnaweb.com.br` para `http://127.0.0.1:3000`. Exemplo com Caddy:

```
blog.medicinalnaweb.com.br {
    reverse_proxy 127.0.0.1:3000
}
```

Atualizar depois de um novo commit:

```bash
git pull && docker compose up -d --build
```

## DNS (Cloudflare)

No registro `blog` da zona `medicinalnaweb.com.br`, trocar o IP antigo
(`169.58.29.233`, servidor da Brasa) pelo IP da VPS da Medicinal.

## Desenvolvimento local

```bash
pnpm install
cp .env.example .env.local   # preencher SUPABASE_ANON_KEY
pnpm dev                     # http://localhost:3001
```
