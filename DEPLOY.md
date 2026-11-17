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

## Deploy na VPS (CloudPanel, site Node.js)

VPS da Medicinal: CloudPanel (Debian 13), IP público `45.170.26.29`.

### Primeira vez

1. **CloudPanel → Sites → Add Site → Create a Node.js Site**
   - Domain Name: `blog.medicinalnaweb.com.br`
   - Node.js Version: **22**
   - App Port: **3010**
   - Site User e senha: anotar (é o usuário que roda o blog)
2. Entrar como o usuário do site (SSH do site, aba **SSH/FTP** do site no CloudPanel) e rodar:

   ```bash
   cd ~/htdocs/blog.medicinalnaweb.com.br
   git clone https://github.com/medicinal-na-web/blog.git app   # repositório privado: usar token de leitura
   cd app
   npm install -g pnpm@9 pm2
   cp .env.example .env.production
   nano .env.production     # preencher SUPABASE_ANON_KEY (chave pública) e REVALIDATE_SECRET
   ./scripts/deploy.sh
   curl -s -o /dev/null -w "%{http_code}\n" -A teste http://127.0.0.1:3010/   # esperado: 200
   ```

3. Religar sozinho depois de reiniciar o servidor: `crontab -e` e acrescentar

   ```
   @reboot cd ~/htdocs/blog.medicinalnaweb.com.br/app && pm2 resurrect
   ```

4. Com o DNS já apontando para a VPS (seção abaixo): no site, aba **SSL/TLS →
   Actions → New Let's Encrypt Certificate**.

### Atualizar depois de um novo commit

```bash
cd ~/htdocs/blog.medicinalnaweb.com.br/app && ./scripts/deploy.sh
```

O script faz `git pull`, build e reinicia o processo no PM2 sem derrubar o site.

### Alternativa: Docker

O `Dockerfile` e o `docker-compose.yml` também funcionam
(`docker compose up -d --build`, porta `127.0.0.1:3010`), para um servidor que
já tenha Docker. No CloudPanel, nesse caso, usar **Create a Reverse Proxy** para
`http://127.0.0.1:3010`.

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
