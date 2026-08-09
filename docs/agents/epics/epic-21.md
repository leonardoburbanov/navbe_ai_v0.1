# EPIC 21 — Mobile LAN companion (Expo)

**Status:** done  
**Goal:** Phone companion on the same Wi‑Fi as Desktop. Pair with a bearer token / QR, then list flows, start and monitor runs, and manage schedules — without MCP, credentials, or flow authoring on the phone.  
**Non-goal:** Play Store / App Store release pipeline; Expo web as the product web UI (see EPIC 22); desktop features (catalog, sync, credentials, flow builder).

## Depends on

- EPIC 8 — REST `/api/v1` surface
- EPIC 18 — schedules REST
- EPIC 20 — Desktop “Allow mobile” (LAN bind `0.0.0.0` + `lan_token` / QR payload)

## Locked decisions

| Decision | Choice |
| --- | --- |
| Stack | Expo ~54 + Expo Router + React Native + TypeScript (`mobile/`) |
| Auth | `Authorization: Bearer <pairing token>` against Desktop LAN URL |
| State | TanStack Query + AsyncStorage (`navbe.connection`) |
| Design | Signal Console tokens mirrored from Desktop (`constants/Colors.ts`) |
| Package manager | npm (`package-lock.json`) |

## In scope

1. Tabs: Home (pair), Flows, Runs, Schedules; detail routes for flow graph + run live view.
2. QR scan (`expo-camera`) of Desktop payload `{"baseUrl","token"}`.
3. REST only: flows / runs (start, cancel, resume) / schedules CRUD + enable/disable.
4. Dagre + SVG read-only flow graph.

## Out of scope

- MCP tool surface on mobile
- Credentials, catalog, sync, flow editor
- Publishing to app stores (dev client / Expo Go is enough for now)

## Layout

```
mobile/
  app/                 # Expo Router routes
  src/api/             # REST client + types
  src/components/      # UI + FlowGraph
  constants/Colors.ts
  package.json
```

## Acceptance

```bash
cd mobile
npm install
npx tsc --noEmit
# Interactive: npm start → pair via Desktop Allow mobile → run a flow
```

## Definition of Done

- [x] Expo app pairs over LAN and persists connection
- [x] Flows list + graph detail + start run
- [x] Runs list (poll) + detail cancel / approve-reject
- [x] Schedules list + create/edit + enable/disable
- [x] Docs: this epic, delivery/quickstart, install companion section, `mobile/README.md`
