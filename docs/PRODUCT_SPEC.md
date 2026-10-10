# NEXUS Product Specification

## 1. Product statement

NEXUS is an AI learning orchestration platform.

Its purpose is not merely to answer a learner's question.

Its purpose is to determine:

> What is the best next learning intervention for this learner, for this concept, at this moment?

---

## 2. Product objectives

NEXUS should:

1. understand the learner's doubt
2. identify relevant subject and concept
3. use the learner's history and current mastery
4. choose an appropriate learning intervention
5. adapt teaching strategy when necessary
6. assess whether understanding improved
7. identify prerequisite gaps
8. update the learner model
9. involve a human teacher when useful
10. ground answers in learner-provided material when appropriate

---

## 3. Primary users

### Student

The student should be able to:

- sign in
- see personalized learning recommendations
- ask a doubt
- receive a personalized explanation
- indicate "Still Confused"
- receive a different teaching strategy
- take adaptive practice
- receive prerequisite remediation
- upload study material
- inspect Learner Twin
- view progress
- receive or request teacher assistance

### Teacher

The teacher should be able to:

- sign in
- view escalated learners
- view teacher-match context
- inspect student learning state
- inspect AI attempts
- inspect assessment performance
- see detected misconception
- see possible prerequisite gap
- receive a teaching recommendation
- complete a learning session
- provide feedback

---

## 4. Product principles

### 4.1 Do not behave like a generic chatbot

A normal interaction:

```text
Question → Answer
```

NEXUS:

```text
Question
  ↓
Understand
  ↓
Personalize
  ↓
Choose Intervention
  ↓
Teach
  ↓
Measure
  ↓
Update
```

### 4.2 Measure learning, not response generation

The product should care about:

> Did the learner understand?

rather than:

> Did the model produce an answer?

### 4.3 Make intelligence visible

The UI should expose selected signals such as:

- detected concept
- current mastery
- previous attempts
- selected teaching strategy
- reason for strategy switch
- prerequisite gap
- teacher match reason

Do not expose model chain-of-thought.

### 4.4 Human override is allowed

Students and teachers should be able to override recommendations.

---

## 5. Core systems

### Learning Router

Chooses one of the next interventions.

Potential interventions:

```text
DIRECT_EXPLANATION
SIMPLIFIED_EXPLANATION
VISUAL_EXPLANATION
ANALOGY
WORKED_EXAMPLE
SOCRATIC_GUIDANCE
ADAPTIVE_PRACTICE
PREREQUISITE_REMEDIATION
HUMAN_TEACHER_ESCALATION
```

### Learner Twin

Tracks estimated learner state per concept.

### Teaching Strategy Switching

Changes teaching method after failure.

### Root-Cause Learning

Detects weak prerequisites.

### Adaptive Practice

Targets weaknesses based on recent performance.

### NEXUS Knowledge Base

Uses learner-provided study material through RAG.

### Teacher Matching

Ranks suitable human teachers.

### Teacher Copilot

Summarizes the learner's context before a teacher session.

---

## 6. Student home

Primary purpose:

> Tell the learner what to do next.

Example:

```text
NEXUS recommends:

Routing needs attention

Current mastery:
43%

Recommended next action:
8-minute visual revision
```

---

## 7. Ask NEXUS

MVP input:
- text

Stretch:
- image
- voice
- document/context attachment

The interface may show:

```text
Understanding your doubt...

Detected concept:
OSPF

Current mastery:
31%

Previous attempts:
2

Selecting the best learning strategy...
```

---

## 8. Resolution Workspace

Should show:

- selected strategy
- concise explanation for why it was selected
- teaching content
- sources when using RAG
- I Understand
- Still Confused
- Test My Understanding

---

## 9. Still Confused flow

`Still Confused` should trigger a workflow.

Example:

```text
Explanation
  ↓
Still Confused
  ↓
Different Strategy
  ↓
Still Confused
  ↓
Assessment
  ↓
Analyze Mistakes
  ↓
Prerequisite Gap?
 ↙            ↘
Yes            No
↓              ↓
Remediation    Alternative / Teacher
```

---

## 10. Adaptive Practice

Adaptive practice should consider:

- target concept
- learner mastery
- previous response
- difficulty
- misconception
- prerequisites

It should not be only a static generated quiz.

---

## 11. Learner Twin

Possible learner state:

```text
Computer Networks

TCP/IP               91%
Subnetting            72%
Routing               43%
Link-State Routing    36%
OSPF                  31%

Preferred strategy:
Visual + Worked Examples

Repeated misconception:
LSDB vs routing table
```

The Learner Twin must affect router decisions.

---

## 12. Root-Cause Learning

Example:

```text
Visible difficulty:
OSPF

Possible underlying gap:
Shortest Path
    ↓
Link-State Routing
    ↓
OSPF
```

NEXUS may recommend prerequisite remediation.

---

## 13. Study material / RAG

Supported MVP:
- PDF

Potential stretch:
- PPT/PPTX
- DOC/DOCX
- image OCR

The system should:
1. parse
2. chunk
3. embed
4. retrieve
5. generate grounded response
6. show source metadata

Never fabricate a source.

---

## 14. Teacher escalation

Potential triggers:

- repeated failed interventions
- low assessment performance
- prerequisite remediation failure
- explicit learner request
- low system confidence

---

## 15. Teacher matching

Possible factors:

- subject expertise
- concept expertise
- language
- availability
- teaching style
- learner preference
- outcomes
- similar misconception experience

Return:
- match score
- short explanation

---

## 16. Teacher Copilot

Session brief should contain:

- student question
- concept
- mastery estimate
- previous AI attempts
- strategies attempted
- assessment result
- likely misconception
- possible prerequisite gap
- recommended teaching approach

---

## 17. MVP

### Must have
- Ask NEXUS
- concept understanding
- Learner Twin
- Learning Router
- personalized explanation
- Still Confused
- strategy switch
- mini assessment
- mastery update
- teacher escalation
- Teacher Copilot

### Strongly desired
- prerequisite graph
- Root-Cause Learning
- adaptive practice
- RAG
- teacher matching
- analytics

### Stretch
- voice
- image doubts
- live chat
- video
- advanced knowledge graph
- advanced learner modeling

---

## 18. Out of scope for hackathon unless explicitly required

- complex admin console
- billing
- production-scale notification system
- complex organization hierarchy
- advanced ML model training
- microservice platform
- event streaming platform
