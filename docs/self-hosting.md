# Self-Hosting on a VPS / Node.js Server

If you prefer to host on your own server or VPS (DigitalOcean, Hetzner, AWS EC2, etc.) instead of Vercel, you can run the RAG Starter Kit directly with Bun or Node.js.

> **Note:** The primary and recommended deployment target is Vercel. Self-hosting on a VPS is an alternative if you require longer function execution times or prefer dedicated infrastructure.

## Architecture

Even when self-hosting the application server, you continue to use **managed cloud services** for state, storage, and AI:

- **Database:** Prisma Postgres (or Neon / Supabase) with pgvector
- **Cache & Rate Limiting:** Upstash Redis (REST API)
- **Document Storage:** Cloudinary
- **Background Jobs:** Inngest Cloud
- **LLMs & Embeddings:** OpenRouter + Google Gemini
- **Application Server:** Node.js 20+ or Bun on your VPS (port 7392)

**No Docker containers, local PostgreSQL clusters, or Redis instances to manage.**

## Prerequisites

- Ubuntu 22.04+ (or any modern Linux distribution)
- Bun or Node.js 20+
- 1GB+ RAM
- Reverse proxy (Caddy or Nginx) for SSL termination

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
bun install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` to include your managed service credentials:
- `DATABASE_URL`: Your Prisma Postgres connection string
- `NEXTAUTH_SECRET`: Random 32-character string (`openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL`: Your production domain (e.g., `https://rag.yourdomain.com`)
- `OPENROUTER_API_KEY`: OpenRouter API key for LLM chat
- `GOOGLE_GENERATIVE_AI_API_KEY`: Gemini API key for embeddings
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis credentials
- `CLOUDINARY_URL`: Cloudinary storage URL

### 3. Run Database Migrations

Apply the Prisma schema to your database:

```bash
bun db:migrate:prod
```

Optionally seed initial templates and documentation:

```bash
bun db:seed
```

### 4. Build the Production Bundle

```bash
bun run build
```

Next.js will output an optimized standalone server.

### 5. Run with a Process Manager (PM2 or systemd)

#### Option A: PM2

Install PM2 globally:

```bash
npm install -g pm2
```

Start the application on port 7392:

```bash
PORT=7392 pm2 start "bun run start" --name rag-starter-kit
pm2 save
pm2 startup
```

#### Option B: systemd

Create a systemd service file at `/etc/systemd/system/rag-starter-kit.service`:

```ini
[Unit]
Description=RAG Starter Kit
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/rag-starter-kit
Environment=NODE_ENV=production
Environment=PORT=7392
ExecStart=/home/ubuntu/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rag-starter-kit
```

### 6. Reverse Proxy & HTTPS

#### Using Caddy (Recommended — Automatic SSL)

Install Caddy and add to `/etc/caddy/Caddyfile`:

```caddy
rag.yourdomain.com {
    reverse_proxy 127.0.0.1:7392
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

#### Using Nginx

```nginx
server {
    server_name rag.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:7392;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with Certbot:

```bash
sudo certbot --nginx -d rag.yourdomain.com
```

## Differences from Vercel

| Feature | Vercel (Hobby) | Self-Hosted VPS |
|---------|----------------|-----------------|
| Function Timeout | 10 seconds | Configurable (Node / reverse proxy) |
| Setup Complexity | 1-click / git push | Manual server & reverse proxy |
| Maintenance | Zero maintenance | OS patches & process monitoring |
| Infrastructure Cost | Free | ~$5-10/month (VPS cost) |
