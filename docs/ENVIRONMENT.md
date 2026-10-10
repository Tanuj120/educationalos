# NEXUS Environment and Configuration

This document defines expected configuration categories.

Exact names should match the final stack.

---

## 1. Environment files

Recommended:

```text
.env.example
.env.local
.env.test
```

Never commit real secrets.

---

## 2. Core application variables

Examples:

```text
APP_ENV=
APP_PORT=
FRONTEND_URL=
BACKEND_URL=
```

---

## 3. Database

```text
DATABASE_URL=
```

or stack-specific fields.

---

## 4. Authentication

Possible:

```text
AUTH_SECRET=
JWT_SECRET=
SESSION_SECRET=
```

Use only what the final auth design requires.

---

## 5. LLM provider

Possible:

```text
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

Do not hardcode provider keys.

---

## 6. Embeddings

Possible:

```text
EMBEDDING_PROVIDER=
EMBEDDING_MODEL=
```

---

## 7. Vector storage

If separate from primary database:

```text
VECTOR_DB_URL=
VECTOR_DB_API_KEY=
```

If using pgvector, this may not be needed.

---

## 8. File storage

Local demo:

```text
UPLOAD_DIR=
```

Cloud:

```text
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

Only if the chosen stack requires it.

---

## 9. Feature flags

Optional hackathon flags:

```text
ENABLE_RAG=
ENABLE_TEACHER_MATCHING=
ENABLE_LIVE_CHAT=
ENABLE_IMAGE_INPUT=
ENABLE_VOICE_INPUT=
DEMO_MODE=
```

Use flags only if they simplify demo safety.

---

## 10. Demo settings

Potential:

```text
DEMO_STUDENT_ID=
DEMO_SUBJECT_ID=
DEMO_RESET_ENABLED=
```

---

## 11. Observability

Possible:

```text
LOG_LEVEL=
AI_DEBUG_LOGGING=
```

---

## 12. `.env.example`

The repository should include an example with placeholders only.

Example:

```text
APP_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/nexus
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
DEMO_MODE=true
```
