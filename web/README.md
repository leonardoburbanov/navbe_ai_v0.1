# Navbe Web

Vite + React **LAN companion** — same responsibility and Signal Console look as
the [mobile](../mobile/) app, in the browser.

Full product notes: [EPIC 22](../docs/agents/epics/epic-22.md).

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- Navbe Desktop with **Allow mobile** enabled (or loopback `navbe serve` + token)

## Run

```bash
cd web
pnpm install
pnpm dev
```

Open http://localhost:5173 (binds on the LAN host so other devices can reach
the UI if needed; the **daemon** URL in pairing is still the Desktop engine).

```bash
pnpm build    # typecheck + production bundle
pnpm preview  # serve dist/
```

## Pairing

1. Desktop: **Allow mobile** → copy base URL + token (or QR JSON).
2. Web Home: paste **Base URL** + **Pairing token**, or paste the full QR JSON
   into the optional field.
3. Connection is stored in `localStorage` (`navbe.connection`).

## Layout

- **&lt;768px:** bottom tabs (Home / Flows / Runs / Schedules)
- **≥768px:** left rail + main content

## What it does

Same REST surfaces as mobile: flows (+ graph), runs (cancel / resume when
paused), schedules (CRUD + enable/disable). No credentials, catalog, sync, or
flow builder.

## Stack

Vite 6, React 18, TypeScript, Tailwind 4, React Router, TanStack Query, dagre.
