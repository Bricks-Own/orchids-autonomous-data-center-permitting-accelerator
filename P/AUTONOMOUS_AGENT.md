# Brick PermitOS autonomous agent

## Purpose

The autonomous agent maximizes defensible permit success readiness by finding omissions early, grounding conclusions in evidence, running reproducible calculations, and escalating professional-review gates.

It does not predict agency approval, practice engineering or law, fabricate modeling, or certify filings.

## Runtime architecture

1. **Scenario planner**
   - greenfield;
   - upsized/modified project;
   - brownfield.
2. **Curated source registry**
   - binding regulations;
   - current official guidance;
   - agency data;
   - project evidence;
   - expert-practice references;
   - illustrative examples.
3. **Deterministic tools**
   - PTE calculation;
   - document generation;
   - input/evidence/source/result validation.
4. **Reward engine**
   - input completeness;
   - evidence coverage;
   - authoritative-source coverage;
   - workflow coverage;
   - calculation integrity;
   - human-review gates.
5. **Persistent runs**
   - run ID;
   - scenario;
   - status;
   - readiness score;
   - complete output/audit record.
6. **User interface**
   - Autonomous Review tab;
   - scenario selection;
   - next actions;
   - blockers;
   - human-review gates.

## API

- `POST /api/autonomy/run`
- `GET /api/autonomy/config`
- `GET /api/sites/:id/autonomy/runs`

## Research expansion

Internet research uses controlled provider adapters:

- allowlisted EPA/eCFR/initial state-agency source snapshots;
- SHA-256 content hashes and retrieval timestamps;
- tenant-scoped evidence uploads with source and as-of metadata;
- initial Tennessee, Virginia, and Texas regulatory packs;
- official RBLC search-plan generation with process codes;
- AERMOD readiness and real-executable job adapter.

Every retrieved proposition must retain source metadata, retrieval date, authority class, limitations, and conflicts. Arbitrary URL fetching remains disabled; official retrieval is HTTPS-only, allowlisted, size-limited, redirect-blocked, sanitized, and auditable.

## Evidence and modeling APIs

- `POST /api/sources/snapshot`
- `GET /api/sources/approved-hosts`
- `POST /api/sites/:id/evidence`
- `GET /api/sites/:id/evidence`
- `GET /api/state-packs`
- `GET /api/state-packs/:state`
- `POST /api/rblc/research-plan`
- `POST /api/aermod/readiness`
- `POST /api/aermod/run`
- `POST /api/aermod/package`
- `POST /api/aermod/parse-output`
- `POST /api/epa/echo/query`
- `GET /api/epa/green-book/registry`
- `POST /api/epa/green-book/query-import`
- `POST /api/sites/:id/rblc/import`
- `POST /api/rblc/comparability`
- `POST /api/sites/:id/reviews`
- `POST /api/sites/:id/reviews/:assignmentId/decision`

The AERMOD adapter expects the official executable path in `AERMOD_EXECUTABLE`. A completed model run remains subject to qualified modeler review.

Professional decisions are chained by SHA-256 and protected by database triggers against update or deletion. The chain verifies sequence and stored approval content; it does not independently verify a reviewer's identity or license, which remains an organizational responsibility.

## Coding autopilot

The repository includes `.codex/skills/brick-permitos-autopilot`. Future Codex work can invoke that skill to apply the source hierarchy, reward policy, release gates, and repeatable quality checks.
