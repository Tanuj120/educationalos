# NEXUS Current Tasks

This file coordinates active work between humans and AI agents.

Update it whenever parallel implementation begins.

---

## Current Phase

IMPLEMENTATION PLANNING

---

## Global rule

Before taking a task:
1. check this file
2. avoid overlapping ownership
3. respect API/schema contracts
4. record major changes in `DECISIONS.md`

---

## Planning Agent

### Current
Create detailed implementation plan.

### Owns
- `docs/IMPLEMENTATION_PLAN.md`

### May propose changes to
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACTS.md`
- `docs/AI_SYSTEM.md`

### Must not
- start full implementation before approval

---

## Frontend Agent

Status:
NOT ASSIGNED

Future ownership:

```text
frontend/**
docs/FRONTEND_SPEC.md
```

Avoid editing backend domain logic.

---

## Backend Agent

Status:
NOT ASSIGNED

Future ownership:

```text
backend/**
docs/API_CONTRACTS.md
docs/DATA_MODEL.md
```

Coordinate shared schemas with other agents.

---

## AI / RAG Agent

Status:
NOT ASSIGNED

Future ownership:

```text
AI integration modules
prompt files
RAG modules
docs/AI_SYSTEM.md
```

Do not change router policy without coordination.

---

## Learner Intelligence Agent

Status:
NOT ASSIGNED

Future ownership:

```text
Learner Twin
Learning Router
Mastery
Prerequisite logic
Teacher ranking
```

---

## Testing / Demo Agent

Status:
NOT ASSIGNED

Future ownership:

```text
tests/**
seed scripts
docs/DEMO_PLAN.md
docs/SEED_DATA.md
docs/TESTING.md
```

---

## Task template

### Task
Name:

### Owner
Agent / human:

### Status
NOT STARTED / IN PROGRESS / BLOCKED / DONE

### Files owned
-

### Dependencies
-

### Acceptance criteria
-

### Notes
-
