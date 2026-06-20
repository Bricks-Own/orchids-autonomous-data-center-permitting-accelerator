# Brick PermitOS deployment model

One repository supports two separate deployments.

## Public demo

- Host: Vercel
- Configuration: root `vercel.json`
- Purpose: sales demonstrations and product evaluation
- Authentication: optional demo workspace; no shared server data
- Storage: browser-local only
- AI: no claims of connected AI unless an API is configured
- URL recommendation: `demo.permitos.com`

The demo must not collect real client project information.

## Secure client application

- Host: container-capable Node.js platform
- Configuration: `permitOS/Dockerfile`
- Purpose: customer accounts and saved projects
- Authentication: required
- Storage: persistent mounted volume during pilot; managed Postgres before multi-instance scaling
- Required secrets: `JWT_SECRET`
- Required configuration: `CORS_ORIGIN`, `DB_PATH`
- Optional AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- URL recommendation: `app.permitos.com`

Example:

```bash
docker build -t brick-permitos ./permitOS
docker run --rm -p 3001:3001 \
  -e NODE_ENV=production \
  -e JWT_SECRET="$JWT_SECRET" \
  -e CORS_ORIGIN="https://app.permitos.com" \
  -e DB_PATH="/app/data/permitos.db" \
  -v permitos-data:/app/data \
  brick-permitos
```

## GitHub and Orchids synchronization

GitHub is the source of truth.

1. Commit and push changes from Codex or a local development environment.
2. In Orchids, use **Pull** before making visual changes.
3. In Orchids, use **Commit & Push** after changes.
4. Pull those changes before editing the same files elsewhere.
5. Avoid simultaneous edits to the same files in Codex and Orchids.

The demo and client deployments should both build from protected branches or tagged releases, not from uncommitted Orchids state.

## Release gates

- Frontend production build passes.
- Tenant-isolation tests pass.
- All generated documents pass automated forbidden-output checks.
- A qualified reviewer approves calculation methodology changes.
- No generated output is labeled verified or filing-ready.
- Production secrets and persistent storage are configured.
