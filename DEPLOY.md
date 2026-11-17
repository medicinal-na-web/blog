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

VPS da Medicinal: CloudPanel (Debian 13), IP `45.170.26.29`. Pré-requisito:
Docker com o plugin compose (`curl -fsSL https://get.docker.com | sh`).

```bash
git clone https://github.com/medicinal-na-web/blog.git
cd blog
cp .env.example .env      # preencher SUPABASE_ANON_KEY (chave pública) e demais valores
docker compose up -d --build
```

O container fica em `127.0.0.1:3010`. No CloudPanel: **Sites → Add Site →
Create a Reverse Proxy**, domínio `blog.medicinalnaweb.com.br`, Reverse Proxy URL
`http://127.0.0.1:3010`. Depois, na aba **SSL/TLS** do site: **Actions → New
Let's Encrypt Certificate** (o DNS já precisa apontar para a VPS).

Atualizar depois de um novo commit:

```bash
git pull && docker compose up -d --build
```

## DNS (Cloudflare)

No registro `blog` da zona `medicinalnaweb.com.br`, trocar o IP antigo
(`169.58.29.233`, servidor da Brasa) por `45.170.26.29`, com a nuvem cinza
(DNS only) até o certificado ser emitido.

## Desenvolvimento local

```bash
pnpm install
cp .env.example .env.local   # preencher SUPABASE_ANON_KEY
pnpm dev                     # http://localhost:3001
```
