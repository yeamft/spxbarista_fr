# spxbarista_fr

Vite + TanStack frontend for the coffee office POS.

```bash
cd client
npm install
npm run dev
```

API lives in **spxbarista_bk**. Put env in that repo as `.env.local` (this app loads `VITE_*` from `../server/.env.local` when both folders sit side by side).

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run print-agent` | Cashier laptop print agent |
