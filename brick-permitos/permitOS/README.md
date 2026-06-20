# Brick PermitOS

Brick PermitOS is a data-center permitting workspace for site intake, air and water applicability screening, potential-to-emit calculations, document drafting, milestone planning, and operational compliance simulations.

## Product modes

- **Demo workspace:** Works as a static Vercel deployment. No account is required; scenario data is stored only in the user's browser. Calculations and draft documents run locally.
- **Connected workspace:** Uses the Express API for authentication, shared sites, documents, compliance records, regulatory search, and AI-assisted workflows.

## Local development

Frontend:

```bash
pnpm install
pnpm dev
```

API:

```bash
cd server
pnpm install
pnpm start
```

The Vite development server proxies `/api` to `http://localhost:3001`.

## Deployment

The root `vercel.json` deploys the frontend from `permitOS/dist`. This supports the demo workspace but does not deploy the Express/SQLite API.

For a connected production environment:

1. Deploy the API to a persistent Node.js host.
2. Replace local SQLite storage with a managed production database before horizontal scaling.
3. Set `VITE_API_URL` to the API's public `/api` URL.
4. Set restrictive `CORS_ORIGIN`, `JWT_SECRET`, and provider credentials on the API host.
5. Run database migrations and end-to-end tests before release.

## Verification

```bash
pnpm build
pnpm lint
cd server && pnpm test
```

Screening outputs and generated documents are decision-support drafts. They require review by qualified environmental, engineering, and legal professionals before filing or operational use.
