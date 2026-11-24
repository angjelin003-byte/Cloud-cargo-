# Cloud Cargo

Compact multi-user warehouse materials management web application with unique warehouse section codes, tracking codes, barcode labels, and real-time inventory synchronization.

## Features

- **Real-time Multi-User Sync**: Server-Sent Events (`/api/stream`) push stock changes, transfers, and active operator presence across connected tabs and sessions.
- **Unique Section & Tracking Codes**: Section-scoped tracking codes (`A01-ALU-001`, `E03-EPX-001`, etc.) with collision validation, lot numbers, and printable barcode tracking labels.
- **Inventory & Movement Ledger**: Quick `+`/`-` stock steppers, inbound/outbound/transfer/cycle-count modals, and a full audit ledger with operator attribution.
- **Operators & Roles**: Multi-operator session switching (`Admin`, `Supervisor`, `Operator`) and operator roster management.

## Getting Started

No external database or API keys are required to build or run locally. Application state persists to `.warehouse-data/store.json`.

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Verify & Build

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Run Production Standalone Build

```bash
npm run build
cp -r .next/static .next/standalone/.next/static
node .next/standalone/server.js
```

## Building on GitHub

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that automatically runs `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` on pushes and pull requests to `main` or `master`.

1. Download or export the project from AI Studio (or push this directory to a new GitHub repository):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Cloud Cargo"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. Open the **Actions** tab on GitHub to view automated builds.
3. Deploy to any Node.js hosting platform (Vercel, Railway, Render, Fly.io, or Cloud Run) with `npm run build`.
