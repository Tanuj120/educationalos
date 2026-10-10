# NEXUS Implementation Plan

> STATUS: DRAFT — HUMAN REVIEW REQUIRED

This file is the main implementation blueprint once approved.

No major implementation should start until the plan is reviewed.

---

## 1. Final technology stack

To be decided by the implementation-planning agent.

### Frontend
TBD

### Backend
TBD

### Primary database
TBD

### ORM / persistence
TBD

### Vector search
TBD

### LLM provider
TBD

### Embeddings
TBD

### Authentication
TBD

### File storage
TBD

### Deployment
TBD

---

## 2. Architecture decision

Recommended default:

**Modular monolith**

The planning agent may override this only with a clear reason.

---

## 3. MVP scope

### Must have
TBD

### Should have
TBD

### Stretch
TBD

### Explicitly out of scope
TBD

---

## 4. Primary user journeys

The final plan must define end-to-end behavior for:

### Student
- login
- dashboard
- ask doubt
- concept understanding
- personalized explanation
- Still Confused
- strategy switching
- assessment
- prerequisite remediation
- adaptive practice
- study material
- Learner Twin
- teacher escalation
- teacher matching
- progress

### Teacher
- login
- teacher dashboard
- incoming learner escalation
- student intelligence
- session brief
- session
- completion
- feedback

For every major step, define:
- frontend action
- backend call
- AI call
- persistence
- failure state

---

## 5. Core system modules

The final plan should decide module boundaries for:

- auth
- students
- teachers
- concepts
- doubts
- learner twin
- learning router
- interventions
- assessments
- practice
- materials / RAG
- teacher matching
- sessions
- analytics

---

## 6. Phase plan

### Phase 0 — Planning and contracts

Deliverables:
- approved architecture
- stack
- domain model
- API contracts
- frontend route map
- AI output schemas
- router rules
- mastery logic

Acceptance:
- implementation can be split among agents without ambiguity

### Phase 1 — Repository foundation

Deliverables:
- frontend app
- backend app
- database
- migrations
- auth skeleton
- environment config
- CI/local scripts

Acceptance:
- both applications run locally
- DB migrations run
- health endpoint works

### Phase 2 — Domain and seed data

Deliverables:
- concepts
- dependencies
- student profile
- teacher profiles
- learner concept state
- demo data

Acceptance:
- seeded OSPF scenario is available

### Phase 3 — Ask NEXUS

Deliverables:
- doubt input
- doubt storage
- concept classification
- basic response workflow

Acceptance:
- user can submit OSPF question and receive structured analysis

### Phase 4 — Learner Twin

Deliverables:
- concept mastery
- learner state API
- learner state UI
- update service

Acceptance:
- demo learner shows deterministic seeded mastery

### Phase 5 — Learning Router

Deliverables:
- router inputs
- deterministic/hybrid decision logic
- reason codes
- tests

Acceptance:
- deterministic test scenarios pass

### Phase 6 — Teaching Strategies + Still Confused

Deliverables:
- multiple teaching strategies
- feedback flow
- strategy switching

Acceptance:
- Still Confused produces a materially different teaching approach

### Phase 7 — Assessment + Adaptive Practice

Deliverables:
- mini assessments
- answer evaluation
- mastery update
- adaptive next question

Acceptance:
- poor OSPF assessment updates learner state

### Phase 8 — Root-Cause Learning

Deliverables:
- prerequisite analysis
- prerequisite remediation
- router integration

Acceptance:
- OSPF demo can identify Link-State Routing weakness

### Phase 9 — RAG

Deliverables:
- PDF upload
- parsing
- chunking
- embeddings
- retrieval
- citations

Acceptance:
- learner can receive an answer grounded in uploaded notes

### Phase 10 — Teacher System

Deliverables:
- teacher profiles
- teacher matching
- escalation
- Teacher Copilot
- session completion

Acceptance:
- demo escalation reaches teacher brief

### Phase 11 — Analytics and UI polish

Deliverables:
- visible learning intelligence
- progress
- animations
- loading states
- errors

### Phase 12 — Demo hardening

Deliverables:
- canonical demo
- fallback behavior
- smoke tests
- stable seed state
- deployment

---

## 7. Parallel workstreams

Suggested workstreams after contracts are frozen:

### Workstream A — Frontend
Owns:
- student UI
- teacher UI
- API client
- state handling
- visualizations

### Workstream B — Backend Domain
Owns:
- persistence
- core APIs
- auth
- doubts
- assessments
- sessions

### Workstream C — AI / RAG
Owns:
- concept understanding
- teaching generation
- document pipeline
- retrieval
- AI schemas

### Workstream D — Learner Intelligence
Owns:
- Learner Twin
- mastery
- Learning Router
- prerequisite analysis
- teacher scoring

### Workstream E — Testing / Demo
Owns:
- seed data
- canonical demo
- smoke tests
- demo reliability
- deployment checks

---

## 8. Final plan requirements

The planning agent must replace all TBD areas and include:

1. final stack
2. architecture diagram
3. database model
4. API groups
5. frontend page map
6. AI workflow
7. router pseudocode
8. mastery update logic
9. RAG flow
10. teacher matching formula
11. demo flow
12. repository structure
13. implementation phases
14. parallel agent ownership
15. tests
16. risks
17. mitigation
18. MVP completion checklist
