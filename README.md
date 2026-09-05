# DealFlow360

Internal B2B sales operations workspace (React 18 + Vite + Express). Warm-neutral paper UI, role-gated internal app, and a separate customer portal.

## Run

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

## Demo accounts (password: `password`)

| Role | Email |
| --- | --- |
| Sales rep | ivan.p@example.net |
| Sales manager | olivia.t@example.org |
| Finance | quinn.m@example.net |
| Admin | beth.t@example.com |
| Customer (Acme) | marco.r@example.org |
| Customer (Globex) | uma.s@example.org |

## Two-laptop live demo

1. Laptop A — log in as **olivia.t@example.org**, open Approvals → **Q-1045 Acme Corp**.
2. Laptop B — log in as **marco.r@example.org**, open **Q-1045**, change a counter discount, click **Submit Request**.
3. Laptop A updates within a few seconds (socket, or 3s polling fallback).
