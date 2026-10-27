# 🚀 CKR Meta Marketing — Production Deployment Guide
**Target Location:** `/var/www/ckr/metamarketing`  
**Backend API Domain:** `metacrm-api.ckrtechnologies.in`  
**Frontend App Domain:** `metacrm.ckrtechnologies.in`  
**Meta Webhook URL:** `https://metacrm-api.ckrtechnologies.in/api/webhook`  
**Webhook Verify Token:** `ckrmetamarketing_verify_token`  

---

## 1. Directory Structure on Server (`/var/www/ckr/`)

```
/var/www/ckr/metamarketing/
├── backend/
│   ├── .env                       # Production environment configuration
│   ├── ecosystem.config.cjs       # PM2 process configuration
│   ├── src/                       # Backend Express & Socket.io codebase
│   ├── uploads/                   # Local uploads directory
│   └── public/                    # Public CDN files
│
└── frontend/
    ├── .env                       # VITE_API_URL=https://metacrm-api.ckrtechnologies.in/api
    ├── dist/                      # Production Vite build (Nginx web root)
    │   ├── index.html
    │   └── assets/
    └── src/                       # Frontend React codebase
```

---

## 2. Server Prerequisites (Ubuntu 22.04 / 24.04 LTS)

SSH into your server as root or sudo user:

```bash
# Update package repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS, Nginx, Certbot & Redis
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git redis-server

# Install PM2 globally
sudo npm install -g pm2

# Create /var/www/ckr directory structure and assign ownership
sudo mkdir -p /var/www/ckr/metamarketing/backend
sudo mkdir -p /var/www/ckr/metamarketing/frontend
sudo chown -R $USER:$USER /var/www/ckr
```

---

## 3. DNS Configuration

In your DNS manager (Cloudflare / Hostinger / GoDaddy):
| Type | Name / Host | Value / Target | Proxy Status |
| :--- | :--- | :--- | :--- |
| **A** | `metacrm-api` | `<YOUR_SERVER_PUBLIC_IP>` | DNS Only (Grey Cloud) |
| **A** | `metacrm` | `<YOUR_SERVER_PUBLIC_IP>` | DNS Only (Grey Cloud) |

*Note: Set to DNS Only initially so Certbot can issue SSL certificates without ACME challenge issues.*

Verify DNS propagation:
```bash
dig +short metacrm-api.ckrtechnologies.in
dig +short metacrm.ckrtechnologies.in
```

---

## 4. Backend Deployment (`/var/www/ckr/metamarketing/backend`)

### A. Deploy Backend Code
```bash
# Navigate to backend directory
cd /var/www/ckr/metamarketing/backend

# Copy or git clone your backend code here
npm install --omit=dev
```

### B. Create Production `.env`
Create `/var/www/ckr/metamarketing/backend/.env`:

```env
# ── Server ────────────────────────────────────────────────────
PORT=5003
NODE_ENV=production

# ── Supabase PostgreSQL Database ─────────────────────────────
SUPABASE_URL=https://yxnylsmyrisqlelrfxir.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4bnlsc215cmlzcWxlbHJmeGlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzA4NjQ4MCwiZXhwIjoyMTA4NjYyNDgwfQ.H8f9ocbgDHp9zWIA5b2LbbN6UZEsrmM2p5VePbVdUSo

# ── JWT Authentication ────────────────────────────────────────
JWT_SECRET=ckr_meta_marketing_super_secure_jwt_secret_2026
JWT_EXPIRES_IN=7d

# ── Meta / WhatsApp Cloud API Platform Settings ───────────────
META_GRAPH_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=ckrmetamarketing_verify_token

# ── File Upload & CDN ─────────────────────────────────────────
UPLOAD_DIR=uploads/
PUBLIC_DIR=public
CDN_BASE_URL=https://metacrm-api.ckrtechnologies.in/api/public

# ── Redis (for queues) ────────────────────────────────────────
REDIS_URL=redis://localhost:6379
```

### C. Start Backend with PM2
Ensure `ecosystem.config.cjs` is present in `/var/www/ckr/metamarketing/backend/`:

```bash
cd /var/www/ckr/metamarketing/backend

# Start backend under PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list and configure auto-start on server boot
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
```

Verify backend is running:
```bash
pm2 status
curl http://127.0.0.1:5003/api/health
```

---

## 5. Frontend Deployment (`/var/www/ckr/metamarketing/frontend`)

### A. Deploy & Build Frontend
```bash
# Navigate to frontend directory
cd /var/www/ckr/metamarketing/frontend

# Copy or git clone your frontend code here
```

Create `/var/www/ckr/metamarketing/frontend/.env`:
```env
VITE_API_URL=https://metacrm-api.ckrtechnologies.in/api
```

Install dependencies and build the production bundle:
```bash
npm install
npm run build
```

This generates the production assets in:
```text
/var/www/ckr/metamarketing/frontend/dist/
```

Verify that `dist/index.html` exists:
```bash
ls -la /var/www/ckr/metamarketing/frontend/dist/
```

---

## 6. Nginx Server Blocks & SSL Configuration

We will configure two clean Nginx blocks:
1. **Frontend App:** `metacrm.ckrtechnologies.in` $\rightarrow$ Serves `/var/www/ckr/metamarketing/frontend/dist`
2. **Backend API & WebSockets:** `metacrm-api.ckrtechnologies.in` $\rightarrow$ Reverse proxy to `http://127.0.0.1:5001`

---

### Block 1: Frontend Server Block (`metacrm.ckrtechnologies.in`)

Create `/etc/nginx/sites-available/metacrm.ckrtechnologies.in`:

```nginx
server {
    server_name metacrm.ckrtechnologies.in;

    root /var/www/ckr/metamarketing/frontend/dist;
    index index.html;

    # Gzip Compression for fast page load
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Single Page Application (SPA) routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

---

### Block 2: Backend API & WebSocket Server Block (`metacrm-api.ckrtechnologies.in`)

Create `/etc/nginx/sites-available/metacrm-api.ckrtechnologies.in`:

```nginx
server {
    server_name metacrm-api.ckrtechnologies.in;

    # Maximum file upload size for documents and media attachments
    client_max_body_size 50M;

    # ── 1. Real-Time WebSockets (Socket.io) ────────────────────
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5003/socket.io/;
        proxy_http_version 1.1;

        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering and set high timeout for persistent sockets
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ── 2. Public CDN Media Storage ────────────────────────────
    location /public/ {
        alias /var/www/ckr/metamarketing/backend/public/;
        expires 30d;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, no-transform";
    }

    # ── 3. Meta WhatsApp Webhooks & REST API ───────────────────
    location / {
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_pass_request_headers on;
    }
}
```

---

### B. Enable Both Sites & Issue SSL Certificates

```bash
# Enable both Nginx sites
sudo ln -sf /etc/nginx/sites-available/metacrm.ckrtechnologies.in /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/metacrm-api.ckrtechnologies.in /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Issue Let's Encrypt SSL Certificates for both domains
sudo certbot --nginx -d metacrm.ckrtechnologies.in -d metacrm-api.ckrtechnologies.in --non-interactive --agree-tos -m dev@ckrtechnologies.in
```

---

## 7. Meta Developer Portal Webhook Configuration

1. Log into **[Meta for Developers](https://developers.facebook.com/)** and select your WhatsApp App.
2. Navigate to **WhatsApp** $\rightarrow$ **Configuration**.
3. Under **Webhook**, click **Edit**:
   - **Callback URL:**
     ```text
     https://metacrm-api.ckrtechnologies.in/api/webhook
     ```
   - **Verify Token:**
     ```text
     ckrmetamarketing_verify_token
     ```
4. Click **Verify and Save**. Meta will send a GET request and confirm verification with HTTP 200.
5. In the Webhook card, click **Manage webhook fields** (or **Webhook Fields** tab):
   - Subscribe to **`messages`** (turn toggle **ON**).

---

## 8. Verification & Live Chat Test Checklist

### Test 1: Verify Webhook Endpoint
```bash
curl "https://metacrm-api.ckrtechnologies.in/api/webhook?hub.mode=subscribe&hub.challenge=test_pass&hub.verify_token=ckrmetamarketing_verify_token"
```
**Expected Response:** `test_pass` (HTTP 200)

### Test 2: Verify WebSocket Connection
```bash
node -e "
const { io } = require('socket.io-client');
const s = io('https://metacrm-api.ckrtechnologies.in', { transports: ['websocket', 'polling'] });
s.on('connect', () => { console.log('✅ WebSocket Connected successfully, ID:', s.id); s.disconnect(); process.exit(0); });
s.on('connect_error', (e) => { console.error('❌ WebSocket Connection Error:', e.message); process.exit(1); });
"
```
**Expected Response:** `✅ WebSocket Connected successfully, ID: ...`

### Test 3: End-to-End Live Chat Test
1. Open your browser at `https://metacrm.ckrtechnologies.in` and log in.
2. Go to **Live Chat** (`/chat`).
3. Send a message from your WhatsApp phone (e.g. `"Hi CKR"`) to `+91 88512 35476` or `+91 89209 32354`.
4. Observe the message pop up in the panel in real time, unlocking the **🟢 24h Window Open** badge!
