# spxbarista_fr

Vite + TanStack frontend for the coffee office POS.

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

| Variable | Local | Production (Vercel) |
|----------|--------|---------------------|
| `VITE_API_URL` | `http://localhost:4000` | `https://spxbarista-bk.onrender.com` |
| `VITE_SOCKET_IO_URL` | `http://localhost:4000` | `https://spxbarista-bk.onrender.com` |

API repo: **spxbarista_bk** (run `npm run dev` there locally).

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run print-agent` | Cashier laptop print agent |

## Deploy to Vercel

1. Import GitHub repo `yeamft/spxbarista_fr`.
2. Build command: `npm run build` · Install: `npm install`.
3. Set environment variables (Production + Preview as needed):
   - `VITE_API_URL` = `https://spxbarista-bk.onrender.com`
   - `VITE_SOCKET_IO_URL` = `https://spxbarista-bk.onrender.com`
4. Deploy. Redeploy after changing `VITE_*` (they are baked in at build time).
5. On Render, set `CORS_ORIGIN` to your Vercel URL (e.g. `https://spxbarista-fr.vercel.app`) and restart the API.
