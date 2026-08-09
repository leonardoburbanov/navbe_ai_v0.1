# Navbe Desktop

Windows **Tauri** ops console for Navbe. Starts or attaches to the local
`navbe serve` daemon and exposes the full human GUI (flows, runs, schedules,
credentials, catalog, sync). **Allow mobile** enables LAN pairing for the
[mobile](../mobile/) and [web](../web/) companions.

| Doc | Purpose |
| --- | --- |
| [BUILD.md](BUILD.md) | Sidecar + NSIS/MSI packaging |
| [EPIC 20](../docs/agents/epics/epic-20.md) | Product scope and DoD |
| [Install](../docs/install.md) | End-user Desktop + companion pairing |

## Run (contributors)

Needs Rust, MSVC Build Tools, Node, and pnpm (see BUILD.md).

```bash
cd desktop
pnpm install
pnpm tauri dev
```

Daemon defaults to `http://127.0.0.1:8000` (same data home as the CLI under
`~/.navbe` / `%USERPROFILE%\.navbe`).
