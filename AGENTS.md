# AGENTS.md

# NEXUS — AI Learning Orchestrator

This file is the canonical operating guide for every AI coding, architecture, planning, testing, design, and documentation agent working on this repository.

Examples include:
- Claude / Claude Code
- Codex
- Antigravity
- Gemini
- IDE coding agents
- autonomous implementation agents
- architecture agents
- testing agents
- review agents

Every agent must read this file before making architectural or product changes.

---

## 1. Project identity

**Project name:** NEXUS  
**Full name:** NEXUS — The AI Learning Orchestrator  
**Tagline:** The right help. At the right time. For every learner.  
**Hackathon:** The Industry Games 2026  
**Challenge:** District 03 — AI-Native Education OS for Intelligent Doubt Resolution  
**Sponsor:** AtomTalk

NEXUS is an AI learning orchestration platform.

It is not intended to be only a chatbot or question-answering interface.

---

## 2. Current project state

Current stage:

**IMPLEMENTATION PLANNING**

The product concept has been defined.

The final engineering architecture, stack, schema, API contracts, and implementation plan have not yet been approved.

Unless a human explicitly instructs otherwise:

1. Do not begin large-scale implementation.
2. Do not generate the entire codebase.
3. Do not make irreversible architectural decisions silently.
4. First create or follow the approved implementation plan.

Once `docs/IMPLEMENTATION_PLAN.md` is approved, it becomes the main engineering blueprint.

---

## 3. Product thesis

A traditional AI tutor behaves roughly like:

```text
Student question
      ↓
LLM
      ↓
Answer
```

NEXUS should behave more like:

```text
Student question
      ↓
Understand the doubt
      ↓
Understand the learner
      ↓
Inspect learning history
      ↓
Inspect concept mastery
      ↓
Inspect prerequisite mastery
      ↓
Inspect previous teaching attempts
      ↓
Retrieve relevant study material when useful
      ↓
Choose the best learning intervention
      ↓
Teach
      ↓
Measure understanding
      ↓
Update learner state
      ↓
Make a better decision next time
```

NEXUS is therefore a:

**LEARNING ORCHESTRATION SYSTEM**

not merely a:

**QUESTION ANSWERING SYSTEM**

---

## 4. Core product question

Every important product and technical decision should help answer:

> What is the best next learning intervention for this student, for this concept, at this moment?

---

## 5. Core loop

Preserve this loop throughout product and architecture:

```text
UNDERSTAND
    ↓
DECIDE
    ↓
TEACH
    ↓
MEASURE
    ↓
LEARN
    ↓
ADAPT
```

At a workflow level:

```text
Student Doubt
     ↓
Doubt Understanding
     ↓
Learner Context
     ↓
Learning Router
     ↓
Learning Intervention
     ↓
Assessment / Feedback
     ↓
Learner Twin Update
     ↓
Next Decision
```

---

## 6. Canonical terminology

Use the following names consistently.

### NEXUS
The overall product.

### Learner Twin
The evolving representation of the learner's current learning state.

### Learning Router
The decision system that chooses the next learning intervention.

### Learning Intervention
The action selected by NEXUS.

### Teaching Strategy
How a concept is taught.

### Strategy Switching
Changing teaching method when a previous method is ineffective.

### Root-Cause Learning
Detecting prerequisite gaps behind the learner's visible difficulty.

### Adaptive Practice
Practice that changes based on learner performance.

### Teacher Copilot
AI-generated context for the teacher before or during a session.

### NEXUS Knowledge Base
RAG-enabled study material supplied by the learner.

### Learning Loop
Intervention → Assessment → Learner Update → Next Intervention.

Do not casually rename these concepts.

---

## 7. Learning Router

The Learning Router is one of the two most important systems in NEXUS.

Potential router inputs include:

- detected subject
- detected concept
- question type
- question difficulty
- current concept mastery
- prerequisite mastery
- previous attempts
- previous teaching strategies
- assessment results
- repeated misconceptions
- student learning preference
- RAG context availability
- student feedback
- AI confidence
- repeated failure

Potential router outputs may include:

```text
DIRECT_EXPLANATION
SIMPLE_EXPLANATION
VISUAL_EXPLANATION
ANALOGY
WORKED_EXAMPLE
SOCRATIC_GUIDANCE
ADAPTIVE_PRACTICE
PREREQUISITE_REMEDIATION
HUMAN_TEACHER_ESCALATION
```

Exact enums may change during implementation planning.

### Router rule

Do not implement the Learning Router as an uncontrolled:

```text
LLM prompt → arbitrary decision
```

unless there is a strong reason.

Prefer an explainable hybrid approach:

```text
structured learner signals
        +
deterministic rules / scoring
        +
optional structured LLM analysis
        ↓
routing decision
```

The router should produce concise product-level reasons.

Example:

```text
Concept: OSPF
Concept mastery: 31%
Previous failed attempts: 2
Assessment score: 33%
Prerequisite gap: detected

Decision:
PREREQUISITE_REMEDIATION

Reason:
Low prerequisite mastery and repeated failure indicate that continuing the same OSPF instruction is unlikely to help.
```

Do not expose private chain-of-thought.

---

## 8. Learner Twin

The Learner Twin is the second most important system.

It may include:

- subject mastery
- concept mastery
- prerequisite mastery
- recurring misconceptions
- assessment history
- doubt history
- previous interventions
- successful teaching strategies
- unsuccessful teaching strategies
- confidence signals
- teacher feedback
- teacher session history
- progress over time

Example:

```text
Computer Networks

TCP/IP               91%
Subnetting            72%
Routing               43%
Link-State Routing    36%
OSPF                  31%

Strongest:
TCP/IP

Needs attention:
OSPF

Repeated misconception:
Link State Database vs Routing Table

Effective strategies:
Visual explanations
Worked examples
```

The Learner Twin must influence system decisions.

It must not exist only as a dashboard.

---

## 9. Mastery model

For the MVP, prefer a simple and explainable mastery model.

Potential signals:

- assessment correctness
- difficulty
- repeated success
- repeated failure
- recency
- student confidence
- teacher feedback
- successful intervention
- unsuccessful intervention

Do not introduce advanced machine learning unless it clearly improves the hackathon result.

Treat mastery as an estimate, not as absolute truth.

---

## 10. Concept dependency graph

Subjects contain concepts.

Concepts may depend on prerequisite concepts.

Example:

```text
Computer Networks
    ↓
Routing
    ↓
Link-State Routing
    ↓
OSPF
```

Another example:

```text
Shortest Path
    ↓
Dijkstra
    ↓
Link-State Routing
    ↓
OSPF
```

The concept graph supports:

- prerequisite detection
- Root-Cause Learning
- adaptive practice
- recommendations
- learner visualization
- mastery analysis

Do not introduce a graph database unless it is justified.

A relational `concept` + `concept_dependency` model may be sufficient.

---

## 11. Root-Cause Learning

NEXUS should distinguish between the visible difficulty and the underlying learning gap.

Example:

Visible problem:

```text
OSPF
```

Possible root cause:

```text
Shortest Path
    ↓
Link-State Routing
    ↓
OSPF
```

When evidence supports it, NEXUS may recommend:

> Before continuing with OSPF, let's strengthen one prerequisite.

This should remain explainable and should not pretend to perfectly diagnose the learner.

---

## 12. Teaching Strategy Switching

When one explanation fails, NEXUS should not simply regenerate a similar answer.

Example:

```text
Direct Explanation
      ↓
Still Confused
      ↓
Visual Explanation
      ↓
Still Confused
      ↓
Worked Example
      ↓
Mini Assessment
      ↓
Poor Result
      ↓
Prerequisite Check
      ↓
Remediation / Teacher Escalation
```

Potential strategies:

```text
DIRECT_EXPLANATION
SIMPLIFIED_EXPLANATION
ANALOGY
VISUAL_EXPLANATION
WORKED_EXAMPLE
SOCRATIC_GUIDANCE
GUIDED_PRACTICE
```

The system should remember strategies already attempted in the current learning journey.

---

## 13. "Still Confused" is a first-class action

`STILL_CONFUSED` must not behave like "regenerate".

It should trigger logic such as:

- what strategy was already attempted?
- what does the Learner Twin indicate?
- has the learner struggled with this concept before?
- is a prerequisite missing?
- should the teaching strategy change?
- should the learner be assessed?
- should the learner be escalated to a teacher?

---

## 14. Adaptive Practice

Adaptive Practice must not simply mean "generate five questions".

Question selection should use:

- target concept
- current mastery
- difficulty
- previous answers
- misconceptions
- prerequisite knowledge

Assessment and practice results must feed back into the Learner Twin.

---

## 15. Assessment loop

Displaying an explanation does not prove learning.

NEXUS should measure understanding.

Possible mechanisms:

- multiple choice
- conceptual questions
- short answers
- application questions
- confidence rating
- explain-in-your-own-words

Core loop:

```text
INTERVENTION
     ↓
ASSESSMENT
     ↓
LEARNING SIGNAL
     ↓
LEARNER TWIN UPDATE
     ↓
NEXT DECISION
```

---

## 16. RAG / NEXUS Knowledge Base

Learners may upload:

- PDFs
- lecture notes
- slides
- textbooks
- assignments

Potential pipeline:

```text
Upload
  ↓
Parse
  ↓
Chunk
  ↓
Embed
  ↓
Store
  ↓
Retrieve
  ↓
Generate grounded response
  ↓
Show source
```

Important rule:

NEXUS is not a PDF chatbot.

RAG supports the learning system; it is not the whole product.

Never fabricate citations.

---

## 17. Teacher escalation

NEXUS is not designed to replace teachers.

Human assistance should be available when AI is no longer the best intervention.

Potential escalation signals:

- repeated failed teaching attempts
- low assessment performance
- prerequisite remediation failure
- explicit student request
- low AI confidence
- repeated misconception

---

## 18. Teacher matching

Teacher matching may use:

- subject expertise
- concept expertise
- availability
- language
- teaching style
- learner preference
- past outcomes
- experience with similar misconceptions

For the MVP, prefer understandable weighted scoring over unnecessary ML.

A teacher match should include a concise explanation.

---

## 19. Teacher Copilot

Before a teacher interacts with a learner, NEXUS should provide context.

The brief may include:

- original question
- detected concept
- current mastery
- previous AI attempts
- strategies attempted
- recent assessment
- detected misconception
- possible prerequisite gap
- recommended teaching approach

Core principle:

> The teacher should never have to start from zero.

---

## 20. AI component philosophy

Potential components:

- Doubt Understanding
- Learning Router
- Teaching System
- RAG System
- Practice Engine
- Assessment System
- Teacher Matching
- Learner Model

Not all of these need to be autonomous agents.

Classify each capability as one of:

```text
LLM call
deterministic application logic
scoring algorithm
database operation
retrieval pipeline
workflow step
autonomous agent
```

Do not create autonomous agents for buzzword value.

---

## 21. Primary users

### Student
May:
- ask doubts
- receive personalized explanations
- select "Still Confused"
- take adaptive practice
- view Learner Twin
- upload study material
- see recommendations
- connect with a teacher
- view progress

### Teacher
May:
- see escalated learners
- inspect learner context
- inspect previous AI attempts
- inspect misconceptions
- receive teaching recommendations
- complete a session
- provide feedback

Admin functionality is not a hackathon priority unless required.

---

## 22. Expected screens

### Student
- Login / Role Selection
- Student Home
- Ask NEXUS
- Resolution Workspace
- Adaptive Practice
- Learner Twin
- Study Materials
- Teacher Match
- Teacher Session
- Progress / Analytics

### Teacher
- Teacher Dashboard
- Student Intelligence
- Session Brief
- Teacher Session

Do not build unnecessary CRUD screens.

---

## 23. Student Home principle

The Student Home should answer:

> What should I do next?

It should not only display analytics.

Example:

```text
NEXUS recommends:

Routing needs attention.

Current mastery:
43%

Recommended activity:
8-minute visual revision
```

---

## 24. Ask NEXUS experience

The product should make selected intelligence visible.

Example:

```text
Understanding your doubt...

Detected concept:
OSPF

Current mastery:
31%

Previous attempts:
2

Preferred strategy:
Visual

Selecting the best learning approach...
```

Do not show hidden chain-of-thought.

Show concise, product-level signals only.

---

## 25. Resolution Workspace

Important actions:

- I Understand
- Still Confused
- Test My Understanding

Potential context:

```text
NEXUS selected:
Visual Explanation

Why?
Your learner profile indicates that visual examples have worked better for similar networking concepts.
```

---

## 26. Explainability

Where useful, explain why NEXUS made a decision.

Examples:

- why practice instead of another explanation?
- why a prerequisite?
- why a strategy change?
- why this teacher?

Use concise reason codes and observable signals.

---

## 27. Canonical demo journey

The application should reliably support this story:

1. Student asks an OSPF question.
2. NEXUS detects the concept.
3. Learner Twin is loaded.
4. Learning Router chooses a personalized explanation.
5. Student selects "Still Confused".
6. NEXUS changes teaching strategy.
7. Student takes a mini assessment.
8. Student performs poorly.
9. NEXUS detects a prerequisite gap.
10. NEXUS recommends prerequisite remediation.
11. Continued failure leads to teacher escalation.
12. Teacher matching runs.
13. Teacher receives a Session Brief.
14. Teacher session is completed.
15. Learner Twin updates.
16. Future recommendations change.

This is the central hackathon demo path.

---

## 28. MVP priorities

### P0 — Must work
- Ask NEXUS
- doubt understanding
- Learner Twin
- Learning Router
- personalized explanation
- Still Confused
- strategy switching
- assessment
- learner update
- teacher escalation
- Teacher Copilot

### P1 — Strongly desired
- adaptive practice
- prerequisite detection
- Root-Cause Learning
- RAG
- teacher matching
- analytics

### P2 — Stretch
- voice
- image doubts
- real-time teacher chat
- live video/audio
- advanced knowledge graph
- advanced mastery modeling

---

## 29. Do not prioritize

Unless specifically required, do not spend hackathon time on:

- advanced admin panels
- billing
- enterprise organization management
- notification systems
- Kubernetes
- Kafka
- unnecessary microservices
- complex event-driven systems
- advanced ML training pipelines

---

## 30. Architecture principles

Optimize for:

```text
Working Demo
+
Correctness
+
Fast Development
+
Maintainability
```

Prefer:

- modular monolith
- one primary relational database
- simple AI orchestration
- explicit domain services
- clear API contracts

Avoid infrastructure for imaginary scale.

---

## 31. Structured AI output

When application logic depends on AI output, prefer structured schemas.

Example:

```json
{
  "subject": "Computer Networks",
  "concept": "OSPF",
  "difficulty": "INTERMEDIATE",
  "possible_prerequisite_gap": "Link-State Routing",
  "confidence": 0.87
}
```

Validate AI output before using it.

---

## 32. AI reliability

Where relevant:

- define schemas
- validate enums
- handle malformed output
- handle timeouts
- use confidence thresholds
- define fallback behavior
- do not persist hallucinated concepts without validation

---

## 33. Low-confidence behavior

If NEXUS is uncertain, do not invent confidence.

Example:

> I think this is about OSPF, but I need a little more context.

Low confidence should be an explicit system state.

---

## 34. Human override

Students and teachers should be able to override AI recommendations.

Examples:

Student:
- request another strategy
- request practice
- request teacher help

Teacher:
- correct a detected misconception
- override teaching recommendation
- provide session feedback

---

## 35. Demo reliability

Critical paths should use reliable seeded data and known test scenarios.

Recommended:
- seeded student
- seeded concept graph
- seeded teacher profiles
- known OSPF journey
- stable prompts
- deterministic router behavior where possible
- pre-indexed demo study material

Do not misrepresent fake outputs as working functionality.

---

## 36. Default demo domain

Use Computer Networks unless a different domain is explicitly selected.

Suggested graph:

```text
Computer Networks
│
├── OSI Model
├── TCP/IP
│   ├── TCP
│   └── UDP
├── IP Addressing
│   └── Subnetting
└── Routing
    ├── Distance Vector
    │   └── RIP
    └── Link-State Routing
        ├── Shortest Path
        └── OSPF
```

---

## 37. Default demo learner

Suggested seeded profile:

```text
Student: Alex

TCP/IP               91%
Subnetting            72%
Routing               43%
Link-State Routing    36%
OSPF                  31%

Preferred strategies:
Visual + Worked Examples

Known misconception:
Confuses LSDB with the final routing table.
```

Exact values may change.

---

## 38. Current instruction to agents

At the current project stage:

**CREATE THE IMPLEMENTATION PLAN. DO NOT START BUILDING YET.**

The implementation plan should be concrete enough that coding agents can later execute with minimal ambiguity.

At minimum, it should define:

1. final technology stack
2. final system architecture
3. domain model
4. database design
5. API groups
6. frontend page map
7. AI workflow
8. Learning Router logic
9. Learner Twin update logic
10. RAG flow
11. teacher system
12. demo path
13. repository structure
14. implementation phases
15. parallel agent assignments
16. testing strategy
17. MVP completion checklist
18. major risks and mitigations

Stop after producing the implementation plan and wait for human approval.
