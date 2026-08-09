# EPIC 22 — Web LAN companion (Vite)

**Status:** done  
**Goal:** Browser companion with the **same job and design language as mobile** (EPIC 21): pair to the local Desktop daemon over LAN, then manage Flows / Runs / Schedules responsively.  
**Non-goal:** Hosted SaaS control plane; Expo web; extracting a shared monorepo `packages/` UI; desktop-only features (credentials, catalog, sync, flow builder).

## Depends on

- EPIC 8 — REST `/api/v1` surface
- EPIC 18 — schedules REST
- EPIC 20 — Desktop “Allow mobile” (LAN + pairing token); CORS allows companion origins when LAN is on
- EPIC 21 — product parity target (mobile companion)

## Locked decisions

| Decision | Choice |
| --- | --- |
| Stack | Vite 6 + React 18 + TypeScript + Tailwind 4 (`web/`, `pnpm`) |
| Routing | `react-router-dom` |
| Auth | Same Bearer pairing token as mobile |
| Persist | `localStorage` key `navbe.connection` |
| Design | Desktop Signal Console CSS variables + IBM Plex |
| Layout | Bottom tabs &lt;768px; left rail ≥768px |
| Pairing UX | Paste URL + token; optional paste of QR JSON (no camera) |

## In scope

1. Routes: `/`, `/flows`, `/flows/:id`, `/runs`, `/runs/:id`, `/schedules`.
2. Port of mobile REST client (`probeConnection`, flows/runs/schedules).
3. Responsive shell + UI primitives matching mobile cards / pills.
4. Dagre + SVG flow graph on flow detail.
5. Root + `web/` gitignore for `node_modules` / `dist` / `.vite`.

## Out of scope

- QR camera scanner
- Vite proxy as the primary LAN transport (direct browser → daemon)
- Store / cloud auth

## Layout

```
web/
  package.json, vite.config.ts, tsconfig.json, index.html
  public/              # logo assets
  src/
    api/               # REST client + types
    components/        # AppShell, UI, FlowGraph, BrandMark
    pages/             # Home, Flows, Runs, Schedules + details
    connection.ts      # localStorage
    ConnectionContext.tsx
    styles.css         # Signal Console tokens
```

## Acceptance

```bash
cd web
pnpm install
pnpm build
pnpm dev   # http://localhost:5173 — pair with Desktop Allow mobile
```

## Definition of Done

- [x] Scaffold + Signal Console theme + responsive shell
- [x] Connection layer + React Query
- [x] Feature parity with mobile companion surfaces
- [x] `pnpm build` green
- [x] Docs: this epic, delivery/quickstart, install companion section, `web/README.md`
