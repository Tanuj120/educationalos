# NEXUS Deployment

The deployment strategy should prioritize hackathon reliability.

---

## 1. Deployment goals

- simple
- repeatable
- fast
- low operational overhead
- easy rollback
- local fallback available

---

## 2. Recommended deployment shape

Final stack may vary, but prefer:

```text
Frontend Hosting
      ↓
Backend Service
      ↓
Managed Relational Database
      ↓
Optional Vector Extension / Store
      ↓
Object Storage
```

Avoid Kubernetes unless already required by the team.

---

## 3. Environments

Recommended:
- local
- demo / production

A separate staging environment is optional.

---

## 4. Database migrations

Deployments must run migrations deliberately.

Do not auto-drop or reset production demo data.

---

## 5. Seed data

Demo environment should include:
- Alex student
- Computer Networks subject
- OSPF concept graph
- teacher profiles
- learner state
- assessment questions

Provide a safe reset mechanism for demo state.

---

## 6. Health checks

Backend should expose:

```text
GET /health
```

Optionally include:
- DB connectivity
- AI provider configuration
- vector store readiness

Avoid making health checks call expensive LLM endpoints.

---

## 7. Rollback

Keep deployment simple enough to roll back to the previous version quickly.

---

## 8. Local fallback

Before presenting, keep:
- a working local environment
- seeded database
- demo PDF
- required API keys
- backup screenshots/video if allowed

The live app should be primary, but a local fallback reduces hackathon risk.

---

## 9. CORS and URLs

Ensure deployed frontend/backend URLs are configured correctly.

---

## 10. Secrets

Use deployment platform secret management.

Never commit secrets.

---

## 11. Demo checklist

Before presentation:
- deployment healthy
- database reachable
- LLM reachable
- RAG indexed
- demo state reset
- teacher profiles present
- canonical smoke test passed
