# NEXUS Architecture

> This document describes the target logical architecture. Final implementation must match the approved implementation plan.

---

## 1. Architecture principle

Prefer:

**simple, modular, testable, demo-reliable architecture**

Default preference:

**modular monolith**

Avoid:
- unnecessary microservices
- distributed queues without a real need
- event streaming infrastructure for the hackathon
- multiple databases without clear value
- agent-per-feature architecture

---

## 2. High-level logical architecture

```text
┌──────────────────────────────────────────┐
│                Frontend                  │
│ Student UI | Teacher UI | Visualizations │
└─────────────────────┬────────────────────┘
                      │ HTTP / Streaming
                      ↓
┌──────────────────────────────────────────┐
│              Backend API                 │
│ Auth | Doubts | Learning | Teachers      │
└───────┬───────────────────────┬──────────┘
        │                       │
        ↓                       ↓
┌───────────────────┐   ┌───────────────────┐
│ Domain Services   │   │ AI / Retrieval    │
│ Router            │   │ LLM               │
│ Learner Twin      │   │ Embeddings        │
│ Assessment        │   │ RAG               │
│ Teacher Matching  │   │ Generation        │
└─────────┬─────────┘   └─────────┬─────────┘
          │                       │
          └───────────┬───────────┘
                      ↓
              ┌──────────────┐
              │ Persistence  │
              │ Relational DB│
              │ Vector Store │
              │ File Storage │
              └──────────────┘
```

---

## 3. Logical modules

Potential backend modules:

```text
auth
users
students
teachers
subjects
concepts
doubts
learning
router
learner_twin
assessments
practice
materials
rag
teacher_matching
sessions
analytics
```

The final implementation may combine some modules.

---

## 4. Dependency direction

Core learning flow:

```text
Doubt
 ↓
Doubt Understanding
 ↓
Learner Twin Lookup
 ↓
Learning Router
 ↓
Learning Intervention
 ↓
Assessment / Feedback
 ↓
Learner Twin Update
```

Teacher flow:

```text
Escalation
  ↓
Teacher Matching
  ↓
Teacher Copilot
  ↓
Teacher Session
  ↓
Teacher Feedback
  ↓
Learner Twin Update
```

RAG flow:

```text
Learning Material
  ↓
Parse
  ↓
Chunk
  ↓
Embed
  ↓
Retrieve
  ↓
Teaching Context
```

---

## 5. Layering

Recommended layers:

### Presentation
HTTP routes / controllers.

### Application
Use-case orchestration.

### Domain
Core business logic:
- router
- mastery
- teacher match
- intervention state

### Infrastructure
- database
- LLM provider
- embedding provider
- file storage
- vector retrieval

This does not require a strict DDD framework; keep it practical.

---

## 6. AI boundary

LLMs are components, not the application.

LLMs may be useful for:
- concept understanding
- explanation generation
- analogy generation
- question generation
- short-answer evaluation
- summary generation

Normal code should handle:
- auth
- persistence
- validation
- scoring
- thresholds
- state transitions
- router constraints
- teacher ranking
- data integrity

---

## 7. Structured contracts

All AI output used by application logic should be structured and validated.

Provider-specific formats should be hidden behind interfaces.

Example interfaces:

```text
DoubtUnderstandingService
TeachingGenerationService
AssessmentEvaluationService
RagRetrievalService
EmbeddingService
```

---

## 8. Router architecture

Recommended:

```text
Doubt Signals
+
Learner Twin
+
Attempt History
+
Assessment Signals
+
Prerequisite State
+
Optional LLM Semantic Signals
      ↓
Router Rule / Score Engine
      ↓
Intervention
+
Reason Codes
```

The router must be testable without a live LLM.

---

## 9. Learner Twin architecture

The Learner Twin should primarily be persisted state.

Potential sources:
- assessments
- feedback
- session results
- interaction history

Do not recalculate the entire profile from LLM conversation history on every request.

---

## 10. RAG architecture

Recommended logical pipeline:

```text
Upload
 ↓
File Storage
 ↓
Parser
 ↓
Chunker
 ↓
Embedding
 ↓
Vector Store
 ↓
Retriever
 ↓
Relevant Chunks
 ↓
Generation
```

Store source metadata for citations.

---

## 11. Failure handling

Architecture must explicitly handle:
- LLM timeout
- malformed LLM output
- low confidence classification
- vector retrieval returning nothing
- document parsing failure
- no teacher available
- assessment evaluation uncertainty
- file upload error

---

## 12. Performance expectations

Hackathon priority:
- interactive response
- reliable demo
- visible progress states

Do not optimize for massive scale before functionality is correct.

---

## 13. Data ownership

Student-specific data:
- learner state
- doubts
- documents
- assessments
- sessions

Teacher-specific data:
- profile
- expertise
- availability
- assigned sessions

Global data:
- subjects
- concepts
- concept dependencies
