# Contributing to NEXUS

This project may be developed by humans and multiple AI coding agents.

The goal of this document is to reduce conflicting changes and keep implementation aligned.

---

## 1. Read before changing code

Before making changes:

1. Read `AGENTS.md`.
2. Read `docs/PRODUCT_SPEC.md`.
3. Read `docs/IMPLEMENTATION_PLAN.md`.
4. Read the documentation relevant to your task.
5. Check `docs/CURRENT_TASKS.md`.
6. Check `docs/DECISIONS.md`.

---

## 2. Authority order

When documents conflict, use this order unless a human explicitly says otherwise:

```text
Human instruction
      ↓
AGENTS.md
      ↓
PRODUCT_SPEC.md
      ↓
IMPLEMENTATION_PLAN.md
      ↓
DECISIONS.md
      ↓
ARCHITECTURE.md / AI_SYSTEM.md / DATA_MODEL.md / API_CONTRACTS.md
      ↓
Code
```

When a conflict is found, do not silently choose one. Report it.

---

## 3. Scope discipline

Keep each change focused.

Do not:
- refactor unrelated modules
- rename canonical concepts casually
- change API contracts without documenting it
- change database schema without updating the data model
- change AI output schemas without updating AI documentation
- introduce new infrastructure without justification

---

## 4. Architecture changes

If a change affects:
- technology stack
- database choice
- service boundaries
- API conventions
- AI architecture
- deployment model
- router behavior
- mastery model

add or update an ADR in `docs/DECISIONS.md`.

---

## 5. API changes

When modifying a public API:
- update `docs/API_CONTRACTS.md`
- update frontend API usage
- update tests
- update affected examples

---

## 6. Database changes

When modifying persistence:
- update `docs/DATA_MODEL.md`
- add migration
- update seed data
- update tests

---

## 7. AI changes

When modifying AI behavior:
- use structured output when application logic depends on it
- validate output
- update `docs/AI_SYSTEM.md`
- preserve failure handling
- preserve explainability
- add tests for deterministic behavior around the AI component

---

## 8. Pull request / task completion checklist

Before declaring a task complete:

- relevant tests pass
- type checks pass
- lint passes
- migrations are valid
- demo path is not broken
- API docs are updated
- architecture docs are updated when necessary
- no secrets are committed
- failure states are handled
- changes are summarized clearly
