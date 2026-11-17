// PM2 — blog em produção (site Node.js do CloudPanel)
// As variáveis vêm de .env.production, na raiz do projeto (fora do git).
const path = require("path");

module.exports = {
  apps: [
    {
      name: "blog",
      cwd: path.join(__dirname, ".next/standalone"),
      script: "server.js",
      node_args: `--env-file=${path.join(__dirname, ".env.production")}`,
      env: {
        NODE_ENV: "production",
        PORT: "3010",
        HOSTNAME: "127.0.0.1",
      },
      max_memory_restart: "600M",
    },
  ],
};
