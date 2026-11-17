# ADR-0001 — Portable TypeScript + PostgreSQL runtime

Status: **Accepted for foundation**  
Date: 2026-09-06

## Decision

Build the Schoolwide core as a containerized TypeScript service using Fastify and PostgreSQL over the standard `pg` client. Keep provider-specific integration outside domain/application contracts.

The initial serious-pilot deployment may use Google Cloud because Google Workspace/Classroom integration, Cloud Run, Cloud SQL, Pub/Sub, and managed secret storage align operationally. That deployment choice does not become a business-layer dependency.

## Why

- The current classroom Apps Script/workbook model has one shared workbook lock and teacher-owned state; Schoolwide needs transactional concurrency and indexed multi-tenant queries.
- PostgreSQL provides mature transactions, constraints, locking, JSON audit metadata, and a portable wire protocol.
- A standard container can run on Cloud Run or another container platform.
- Fastify keeps the service small while providing mature TypeScript support and request lifecycle controls.
- Provider portability keeps district/vendor review from forcing a rewrite.

## Explicit non-decisions

SW-010 does not choose the final production cloud account/project, identity provider implementation, realtime transport, ORM, queue service, Classroom webhook strategy, or analytics platform.

## Dependency policy

Pin a narrow dependency set. New vendor SDKs require an explicit reason and must be wrapped behind an interface if they touch domain/application behavior.
