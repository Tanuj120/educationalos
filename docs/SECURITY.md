# NEXUS Security

This is a hackathon security baseline.

The goal is practical safety without enterprise overengineering.

---

## 1. Authentication

Use a standard authentication mechanism.

Requirements:
- passwords hashed securely if stored
- auth tokens protected
- role checked server-side
- no trust in client role claims

---

## 2. Authorization

Students may access:
- their own profile
- their own doubts
- their own learner state
- their own study material
- their own sessions

Teachers may access:
- their own profile
- assigned/escalated student context
- sessions they participate in

Do not allow arbitrary teacher access to all learner data unless explicitly intended for demo.

---

## 3. Study material ownership

Every uploaded file must have an owner.

Retrieval must filter by allowed ownership.

A learner must never retrieve another learner's private study material.

---

## 4. File upload safety

Validate:
- MIME type
- extension
- size
- upload status

Avoid executing uploaded files.

Store outside the web root.

---

## 5. Prompt injection / RAG

Treat document text as untrusted data.

Do not allow retrieved document instructions to override system instructions.

Separate:
- system prompt
- user request
- retrieved context

The model should be told that retrieved content is reference material, not executable instruction.

---

## 6. AI output validation

Never trust AI output directly.

Validate:
- enums
- IDs
- confidence range
- referenced concepts
- structured fields

---

## 7. Secrets

Never commit:
- API keys
- database passwords
- auth secrets
- provider credentials

Use environment variables.

Provide `.env.example`, not real `.env`.

---

## 8. CORS

Allow only intended frontend origins in deployed environments.

---

## 9. Rate limiting

Optional for hackathon.

At minimum, protect expensive AI endpoints from accidental repeated calls if practical.

---

## 10. Logging

Do not log:
- passwords
- access tokens
- secrets
- entire private documents unnecessarily

---

## 11. Teacher session privacy

Only assigned teacher and relevant learner should have access to private session context.

---

## 12. Demo mode

Seed data must clearly be demo data.

Do not use real student data in the hackathon demo.
