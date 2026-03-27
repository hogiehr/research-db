# Research DB

Private research database — positions, trade ideas, security thesis, macro, market updates.

## Deploy to Vercel

### 1. Create GitHub repo

```bash
cd research-db
git init
git add .
git commit -m "init"
# create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/research-db.git
git push -u origin main
```

### 2. Create Vercel project

1. Go to [vercel.com](https://vercel.com) → New Project → import your repo
2. Framework: **Next.js** (auto-detected)
3. Click **Deploy** — it'll fail on first deploy because KV isn't set up yet, that's fine

### 3. Add Vercel KV (Redis)

1. In your Vercel project → **Storage** tab → **Create Database** → **KV**
2. Name it anything (e.g. `research-db-kv`)
3. Click **Connect** — this auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your env vars

### 4. Redeploy

```bash
# In Vercel dashboard → Deployments → Redeploy
# Or push any change:
git commit --allow-empty -m "trigger deploy"
git push
```

### 5. Set your URL

In Vercel project settings → **Domains** → add a custom domain or use the auto-generated one like `research-db-xyz123.vercel.app`. Keep it obscure — no auth needed.

## Local dev

```bash
npm install
# Copy env vars from Vercel dashboard → Settings → Environment Variables
cp .env.example .env.local
# Fill in KV_REST_API_URL and KV_REST_API_TOKEN
npm run dev
```

## Notes

- Data auto-saves 800ms after any change (debounced) — you'll see SAVING/SAVED in the header
- Prices via Yahoo Finance — server-side to avoid CORS
- Options G/L = (eq last − eq entry) × contracts × 100, flipped for puts
- Thesis links point to OneDrive URLs — paste the share link directly
