# NEXUS Architecture Decision Log

Use this file for important decisions.

Do not record trivial implementation details.

Status values:
- PROPOSED
- ACCEPTED
- SUPERSEDED
- REJECTED

---

# ADR-001 — Application Architecture

**Status:** PROPOSED

## Context
NEXUS is a hackathon application requiring fast development, clear module boundaries, and reliable integration.

## Decision
Prefer a modular monolith.

## Alternatives
- microservices

## Why
A modular monolith minimizes deployment and coordination overhead while still allowing clean domain separation.

## Consequences
Modules must remain well separated even within one deployable backend.

---

# ADR-002 — Primary Database

**Status:** PENDING

## Context
NEXUS needs relational domain data and potentially vector search.

## Decision
TBD

## Options
- PostgreSQL
- MySQL

## Notes
If PostgreSQL + pgvector is selected, vector retrieval can remain in the primary database for the hackathon.

---

# ADR-003 — Vector Retrieval

**Status:** PENDING

## Decision
TBD

## Options
- pgvector
- dedicated vector database

## Default preference
Use the simplest option compatible with the chosen stack.

---

# ADR-004 — Learning Router

**Status:** PROPOSED

## Decision
Use a hybrid deterministic router with optional structured AI signals.

## Why
Router behavior should remain explainable, testable, and reliable.

## Consequence
LLM output should inform routing but should not fully control state transitions.

---

# ADR-005 — Learner Twin

**Status:** PROPOSED

## Decision
Persist learner state explicitly rather than reconstructing it from raw conversations on every request.

## Why
This improves reliability, performance, explainability, and demo consistency.

---

# ADR-006 — Concept Graph

**Status:** PROPOSED

## Decision
Use relational concept and concept-dependency records unless a graph database is clearly justified.

---

# ADR-007 — Canonical Demo Domain

**Status:** PROPOSED

## Decision
Use Computer Networks with the OSPF learning journey.

---

# ADR Template

## ADR-XXX — Title

**Status:** PROPOSED

### Context
What problem are we solving?

### Decision
What was chosen?

### Alternatives
What else was considered?

### Why
Why was this selected?

### Consequences
What does this make easier/harder?
