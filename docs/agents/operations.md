# Operations

## Install (operators)

End-user and contributor install, CLI surface, and release assets:
**[../install.md](../install.md)**.

```bash
# end-user
curl -fsSL https://raw.githubusercontent.com/leonardoburbanov/navbe_ai/main/scripts/install.sh | bash
# Windows: irm …/scripts/install.ps1 | iex

navbe setup
navbe mcp configure
```

## Local commands (contributors)

```bash
uv sync
uv run ruff check .
uv run ty check src/
uv run lint-imports
uv run pytest
uv run pytest tests/unit/core/test_config.py -v
uv run navbe --help
uv run navbe serve --help
```

Prefer the commands documented in [AGENTS.md](../../AGENTS.md) and
[../install.md](../install.md).

### Companion UIs (contributors)

```bash
# Desktop (Windows; needs Rust + MSVC for tauri)
cd desktop && pnpm install && pnpm tauri dev

# Mobile
cd mobile && npm install && npm start

# Web companion
cd web && pnpm install && pnpm dev
```

Pair phones/browsers via Desktop **Allow mobile** (see [../install.md](../install.md)).

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `NAVBE_DB_PATH` | SQLite control-plane path | `<data-home>/navbe.db` |
| `NAVBE_FLOWS_DIR` | Flow definitions directory | `<data-home>/navbe_flows` |
| `NAVBE_SCHEDULES_DIR` | Schedule definitions directory | `<data-home>/navbe_schedules` |
| `NAVBE_CREDENTIALS_PATH` | Local credentials JSON | `<data-home>/navbe_credentials.json` |
| `NAVBE_SYNC_CONFIG_PATH` | GitHub sync config JSON | `<data-home>/navbe_sync.json` |
| `NAVBE_GITHUB_OAUTH_PATH` | Managed GitHub App token JSON | `<data-home>/navbe_github_oauth.json` |
| `NAVBE_GITHUB_APP_CLIENT_ID` | GitHub App client id (Device Flow) | Navbe AI public client id |
| `NAVBE_GITHUB_APP_SLUG` | App slug for install URL | `navbe-ai` |
| `NAVBE_GITHUB_OAUTH_CLIENT_ID` | Legacy alias for app client id | unset |
| `NAVBE_LAN_TOKEN` | LAN pairing Bearer token (Desktop writes `lan_token` file) | unset / file |
| `NAVBE_LOG_LEVEL` | Log level | `INFO` |
| `NAVBE_MCP_SERVER_NAME` | MCP server name | `navbe` |

API keys (Anthropic, Resend, CRM, …) are **not** env vars — store them in the
credentials JSON via `navbe secret set` / MCP `secret_set`.

`<data-home>` is the repo root when running from a checkout, otherwise `~/.navbe`.

See [`.env.example`](../../.env.example).

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) on push/PR to `main` and `develop`:

1. `uv sync`
2. `uv run ruff check .`
3. `uv run ty check src/`
4. `uv run lint-imports`
5. `uv run pytest --cov-fail-under=0`

## Branching

- `develop` — default branch; daily PRs land here.
- `main` — shipped product. Merge `develop` → `main` only when cutting a release (or merge a `hotfix/*` PR).
- Feature PRs target `develop`. End-user install scripts stay on `main`.

GitHub settings (repo admin, not in git): default branch = `develop`; protect `main` and `develop` (no direct pushes, PRs + CI required).

## Releases

Ship from `main` after it matches the `develop` you want to release:

1. PR `develop` → `main` and merge.
2. Tag `v*` on `main` (see [../install.md](../install.md)).
3. [`.github/workflows/release.yml`](../../.github/workflows/release.yml) builds, uploads wheel/sdist/install scripts, publishes to PyPI.
4. [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml) attaches Windows installers.

If you tagged a hotfix on `main`, merge `main` back into `develop`.

No automated wiki generation job — agent docs under `docs/agents/` are hand-maintained.
