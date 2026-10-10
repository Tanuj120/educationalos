# NEXUS Observability

Hackathon observability should be lightweight but useful.

The main goal is fast debugging and explaining system decisions.

---

## 1. Logging principles

Log:
- request ID
- user ID where appropriate
- doubt ID
- intervention ID
- assessment ID
- teacher session ID
- router decision
- reason codes
- AI operation
- latency
- success/failure

Avoid logging:
- passwords
- secrets
- tokens
- unnecessary document content
- excessive personal data

---

## 2. Learning Router logs

Every router decision should be inspectable.

Example:

```json
{
  "event": "learning_router_decision",
  "student_id": "stu_1",
  "doubt_id": "doubt_1",
  "concept": "OSPF",
  "mastery": 0.31,
  "attempt_count": 2,
  "assessment_score": 0.33,
  "prerequisite_mastery": 0.36,
  "decision": "PREREQUISITE_REMEDIATION",
  "reason_codes": [
    "LOW_PREREQUISITE_MASTERY",
    "MULTIPLE_FAILED_ATTEMPTS"
  ]
}
```

---

## 3. AI call logs

Capture:
- operation name
- provider
- model
- latency
- token usage if available
- output schema validation
- retry count
- error type

Do not log raw prompts/responses in production by default if they contain sensitive data.

For local hackathon debugging, raw logging may be temporarily enabled with care.

---

## 4. RAG logs

Capture:
- query ID
- material IDs searched
- number of retrieved chunks
- top similarity scores
- whether citations were returned
- retrieval latency

---

## 5. Metrics

Useful MVP metrics:

### Technical
- API latency
- AI latency
- AI failure rate
- document processing failures

### Product
- doubts created
- intervention type count
- Still Confused rate
- teacher escalation rate
- assessment completion
- teacher session completion

Do not build complex dashboards unless time permits.

---

## 6. Correlation

Use a request or trace ID to link:

```text
Doubt
→ AI analysis
→ Router decision
→ Intervention
→ Assessment
→ Learner update
```

This is especially useful during the demo.

---

## 7. Debug mode

A developer-only debug view may show:
- router inputs
- router decision
- reason codes
- concept detection
- mastery values

Never expose private chain-of-thought.
