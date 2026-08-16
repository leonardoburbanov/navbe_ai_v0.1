# Contributing to Navbe

Thanks for helping improve Navbe. This guide covers how to propose changes safely.

## Development setup

```bash
git clone https://github.com/leonardoburbanov/navbe_ai.git
cd navbe_ai
uv sync
uv run navbe bootstrap
```

Use `uv run …` inside a checkout so you exercise the working tree.

## Before you open a PR

```bash
uv run ruff check .
uv run ty check src/
uv run lint-imports
uv run pytest
```

## Branching and PRs

Simplified GitFlow: `develop` is integration; `main` is shipped product.

1. Create a feature branch from `develop` (direct pushes to `develop` and `main` are blocked).
2. Open the PR against `develop`. Keep PRs focused — one concern per PR when practical.
3. Fill in the short PR template (why + breaking). CI is the test gate, not the checklist.
4. Wait for the **CI** check to pass, then squash-merge into `develop`.
5. To ship: PR `develop` → `main`, then tag `v*` on `main` (see [docs/install.md](docs/install.md)).
6. Hotfix: branch from `main`, PR into `main`, tag, then merge `main` back into `develop`.

## Code guidelines

Authoritative rules for agents and humans live in [`AGENTS.md`](AGENTS.md). Highlights:

- Business logic in domain `service.py` files; keep MCP tools and FastAPI routes thin.
- Type hints on public APIs; docstrings on public functions/classes.
- Do not commit secrets, `.env`, or `navbe_credentials.json`.
- Prefer extending an existing domain over adding a new top-level package.
- Ask before changing MCP tool names or argument shapes.

## Tests

- Prefer fakes at Protocol boundaries — no live production APIs in unit tests.
- Add or update tests when asked / when behavior changes in a non-trivial way.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, see [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
