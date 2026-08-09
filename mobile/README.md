# Navbe Mobile

Expo / React Native **LAN companion** for Navbe Desktop. Pair over the same
Wi‑Fi, then run and monitor workflows from your phone.

Full product notes: [EPIC 21](../docs/agents/epics/epic-21.md).

## Prerequisites

- Node.js 20+
- Expo Go (or a dev build)
- Navbe Desktop with **Allow mobile** enabled (LAN token + URL / QR)

## Run

```bash
cd mobile
npm install
npm start
```

Then open the project in Expo Go (scan Metro QR) or press `a` / `i` for
Android / iOS simulator.

## Pairing

1. On Desktop: **Allow mobile** → copy base URL + token, or show the QR.
2. On Home: paste URL + token, or **Scan QR**.
3. Connection is stored in AsyncStorage (`navbe.connection`).

QR payload shape:

```json
{"baseUrl":"http://192.168.x.x:8000","token":"<lan_token>"}
```

## What it does

| Surface | Actions |
| --- | --- |
| Home | Pair / reconnect / disconnect |
| Flows | List, open graph, start run |
| Runs | Live list (poll), detail, cancel, approve/reject |
| Schedules | List, create/edit, enable/disable |

Auth: `Authorization: Bearer <token>` against the Desktop daemon REST API.

## Non-goals

Credentials, catalog, sync, MCP, and flow editing stay on Desktop / CLI / agents.

## Stack

Expo ~54, Expo Router, TanStack Query, React Native SVG + dagre for graphs.
