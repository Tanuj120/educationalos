# NEXUS Testing Strategy

The goal is not maximum enterprise coverage.

The goal is reliable core behavior and a dependable hackathon demo.

---

## 1. Test pyramid

### Unit tests
For:
- router
- mastery calculation
- teacher matching
- prerequisite logic
- validation

### Integration tests
For:
- API + DB
- AI schema parsing
- RAG ingestion
- assessment submission

### End-to-end tests
For:
- canonical student journey
- teacher escalation path

---

## 2. Learning Router tests

Create deterministic cases.

### Case A — first attempt, high mastery

```text
mastery: 85%
attempts: 0
```

Expected:
`DIRECT_EXPLANATION`

### Case B — first attempt, low mastery, visual preference

```text
mastery: 35%
preferred_strategy: VISUAL_EXPLANATION
attempts: 0
```

Expected:
`VISUAL_EXPLANATION`

### Case C — repeated failure + low prerequisite

```text
attempts: 2
assessment: 25%
prerequisite_mastery: 20%
```

Expected:
`PREREQUISITE_REMEDIATION`

### Case D — remediation failed

```text
attempts: 3
assessment: 25%
remediation_attempted: true
```

Expected:
`HUMAN_TEACHER_ESCALATION`

### Case E — explicit teacher request

Expected:
`HUMAN_TEACHER_ESCALATION`

---

## 3. Learner Twin tests

Verify:
- correct answers can increase mastery
- incorrect answers do not increase mastery incorrectly
- mastery remains bounded
- confidence changes appropriately
- teacher feedback can affect state
- concept history is preserved
- updates are deterministic

---

## 4. Concept graph tests

Verify:
- prerequisite edges are valid
- cycles are rejected or handled
- prerequisite lookup works
- OSPF chain returns Link-State Routing

---

## 5. AI schema tests

Verify:
- valid structured response passes
- invalid enum fails
- missing field fails or defaults safely
- low confidence is handled
- unknown concept is handled
- provider error uses fallback

---

## 6. Teaching Strategy tests

Verify:
- Still Confused does not reuse the same strategy without reason
- strategy history is preserved
- generated content matches requested strategy structurally

---

## 7. Assessment tests

Verify:
- scoring is correct
- misconception is recorded
- mastery update occurs once
- duplicate submission is safe
- poor OSPF score can trigger prerequisite path

---

## 8. Adaptive Practice tests

Verify:
- next question targets detected weakness
- difficulty changes when configured
- repeated question is avoided
- results feed Learner Twin

---

## 9. RAG tests

Verify:
- PDF can be ingested
- chunks retain metadata
- retrieval returns expected OSPF chunk
- citations point to correct material
- no-result state is handled
- a citation is never invented

---

## 10. Teacher matching tests

Verify:
- Priya ranks highest for canonical demo
- unavailable teacher is penalized
- concept expertise has appropriate influence
- reason codes match scoring

---

## 11. Teacher Copilot tests

Verify:
- summary includes real attempts
- assessment score is correct
- detected misconception is correct
- no nonexistent interaction is invented

---

## 12. Frontend tests

Critical controls:
- Ask NEXUS
- Still Confused
- Test My Understanding
- prerequisite remediation
- teacher escalation
- teacher selection
- teacher session completion

States:
- loading
- low confidence
- error
- retry
- empty
- success

---

## 13. Demo smoke test

Before every demo:

```text
Reset demo state
→ Login as Alex
→ Ask OSPF question
→ Visual Explanation
→ Still Confused
→ Worked Example
→ Still Confused
→ Assessment 1/3
→ Prerequisite Gap
→ Teacher Escalation
→ Priya Match
→ Teacher Brief
→ Complete Session
→ Learner Twin Update
```

If any step fails, demo is not ready.
