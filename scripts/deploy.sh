#!/usr/bin/env bash
# Atualiza e (re)inicia o blog no servidor. Rodar como o usuário do site no CloudPanel.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Falta o arquivo .env.production (copie de .env.example e preencha)." >&2
  exit 1
fi

git pull --ff-only
pnpm install --frozen-lockfile
pnpm build

# O modo standalone do Next.js não copia os arquivos estáticos sozinho
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/

pm2 startOrReload ecosystem.config.cjs
pm2 save
echo "Blog no ar em 127.0.0.1:3010"
