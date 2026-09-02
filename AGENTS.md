# AGENTS.md

## What this repo is

Docs-only design repository for **Bank USAC**, a microservices banking platform. It contains the architecture decision document (ADR) and its diagram images — **there is no application source code, package manifest, build/test/lint config, or CI yet**. Do not expect to build or run anything.

- `Docs/Documentacion.md` — the single source of architectural truth (specs, rules, event catalog, tech decisions, SLI/SLO/SLA).
- `Docs/img/*.png` — diagrams referenced by the document.
- `README.md` — placeholder only (single line), no useful content.

## Architecture (from the ADR) — do not contradict these

Hard constraints for any future implementation:

- Exactly **5 microservices**: Customer, Account, Transaction, Payment, Notification & Audit.
- Each service owns its **own independent PostgreSQL database**; no service may read another's DB (RNF-03, RN-18).
- **API Gateway (Node + Express) is the only external entry point** (RNF-05) and holds **no business logic / Saga coordination** (RNF-06).
- **All inter-service communication is asynchronous** via **RabbitMQ** (RNF-04); the Gateway is NOT a channel for service-to-service traffic.
- Every message uses a `correlationId`; consumers must be **idempotent** (RNF-07/RNF-08, RN-12).
- **Saga pattern** with compensation for transfers (state machine: REQUESTED → PENDING → COMPLETED / FAILED / COMPENSATING / COMPENSATED). Account Service owns balance changes.
- Tech stack: TypeScript + Node + Express backend, React + TS frontend, Prisma ORM, JWT auth, Docker, local Kubernetes with NGINX Ingress, Prometheus/Grafana, JSON logs.
- Consistency is eventual; there are retries (3 attempts: 5s/15s/30s) then a Dead Letter Queue.
- Event catalog, message envelope format, business rules (RN-xx), and SLI/SLO/SLA tables are all authoritative in `Docs/Documentacion.md`.

## Conventions

- Documentation content is written in **Spanish**; keep new docs/labels consistent with that.
- If docs and any future code diverge, follow the code but flag the discrepancy (RNF-16 requires doc↔impl consistency).
- Keep every diagram referenced in `Documentacion.md` in sync with the described architecture (RNF-16).
- Monorepo layout is planned (RNF-14) but not yet scaffolded.
