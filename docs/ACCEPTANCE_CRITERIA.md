# NEXUS MVP Acceptance Criteria

The MVP is considered complete only when the following criteria are satisfied.

---

## 1. Application

- frontend runs
- backend runs
- database migrations work
- demo seed script works
- demo user can sign in or enter demo mode
- app is deployable

---

## 2. Ask NEXUS

Given the demo learner asks:

> How does OSPF select the shortest path?

NEXUS must:
- create a doubt
- detect Computer Networks
- detect OSPF
- load learner context
- show a valid initial intervention

---

## 3. Learner Twin

The demo learner must show:
- concept mastery
- at least one weak concept
- at least one preferred strategy
- at least one known misconception

Learner state must be stored and updateable.

---

## 4. Learning Router

Router must:
- accept structured inputs
- produce a valid intervention
- produce reason codes
- be testable without a live LLM

Deterministic router test cases must pass.

---

## 5. Strategy Switching

When learner selects `Still Confused`:
- system records feedback
- system chooses a different teaching strategy
- system does not simply regenerate the same response

---

## 6. Assessment

The demo learner can:
- complete a 3-question assessment
- receive a score
- have the misconception recorded
- trigger a learner-state update

---

## 7. Root-Cause Learning

For the canonical OSPF path:
- system can identify Link-State Routing as a prerequisite concern
- system can recommend prerequisite remediation

---

## 8. Teacher Escalation

After configured failure conditions:
- router can select `HUMAN_TEACHER_ESCALATION`
- teacher matching runs
- at least 3 demo teachers can be ranked
- Priya should rank first in the canonical demo

---

## 9. Teacher Copilot

Teacher view must include:
- student question
- detected concept
- mastery
- prior teaching attempts
- assessment result
- misconception
- prerequisite concern
- recommended teaching approach

No nonexistent history should be invented.

---

## 10. Learner Twin update after teacher session

Completing the demo session must:
- persist teacher outcome
- update relevant learner state
- visibly change at least one recommendation or mastery signal

---

## 11. RAG

If RAG is in MVP:
- PDF upload works
- processing reaches indexed state
- retrieval returns relevant text
- response shows valid source metadata
- no-result state is handled
- citations are not fabricated

---

## 12. Error handling

Critical paths must handle:
- AI timeout
- invalid AI response
- no relevant RAG result
- no teacher available
- assessment failure
- network/API error

No unrecoverable blank screen.

---

## 13. Demo reliability

Canonical demo smoke test must pass at least three consecutive times before presentation.

---

## 14. Documentation

Before MVP freeze:
- `IMPLEMENTATION_PLAN.md` approved
- `ARCHITECTURE.md` current
- `DATA_MODEL.md` current
- `API_CONTRACTS.md` current
- `AI_SYSTEM.md` current
- `DEMO_PLAN.md` current
- `DECISIONS.md` current
