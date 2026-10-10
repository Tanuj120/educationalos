# NEXUS AI System

## 1. AI philosophy

NEXUS uses AI where semantic understanding and generation are useful.

It should not make every system decision through an LLM.

Use:
- deterministic logic for state and constraints
- scoring for ranking
- LLMs for language understanding and generation
- RAG for learner-provided material
- explicit schemas between AI and application code

---

## 2. Core AI workflow

```text
Student Question
      ↓
Doubt Understanding
      ↓
Concept Detection
      ↓
Learner Context
      ↓
Learning Router
      ↓
Teaching Intervention
      ↓
Assessment / Feedback
      ↓
Learner Twin Update
```

---

## 3. Doubt Understanding

Responsibilities:
- classify subject
- identify concept
- determine likely intent
- estimate difficulty
- detect ambiguity
- identify possible prerequisite
- provide confidence

Suggested structured output:

```json
{
  "subject": "Computer Networks",
  "concept": "OSPF",
  "question_type": "CONCEPTUAL",
  "difficulty": "INTERMEDIATE",
  "ambiguous": false,
  "possible_prerequisite": "Link-State Routing",
  "confidence": 0.92
}
```

Validate against known concepts whenever possible.

---

## 4. Learning Router

Preferred design:

**Hybrid deterministic router**

Inputs may include:

```text
concept
concept_mastery
prerequisite_mastery
attempt_count
strategies_used
latest_assessment_score
repeated_misconception
learner_preference
explicit_student_request
ai_confidence
```

Possible outputs:

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

Router response:

```json
{
  "intervention": "PREREQUISITE_REMEDIATION",
  "reason_codes": [
    "LOW_PREREQUISITE_MASTERY",
    "MULTIPLE_FAILED_ATTEMPTS",
    "LOW_ASSESSMENT_SCORE"
  ],
  "target_concept": "Link-State Routing"
}
```

Do not use hidden chain-of-thought as a persisted reason.

---

## 5. Example router logic

Illustrative only:

```text
if student explicitly requests teacher:
    HUMAN_TEACHER_ESCALATION

else if ai confidence is too low:
    ASK_CLARIFYING_QUESTION or HUMAN_TEACHER_ESCALATION

else if failed_attempts >= 2 and prerequisite_mastery < threshold:
    PREREQUISITE_REMEDIATION

else if failed_attempts >= 3 and latest_assessment < threshold:
    HUMAN_TEACHER_ESCALATION

else if first attempt and preferred strategy is visual:
    VISUAL_EXPLANATION

else if previous strategy was direct explanation:
    WORKED_EXAMPLE

else:
    ADAPTIVE_PRACTICE
```

Final thresholds belong in the implementation plan.

---

## 6. Teaching Strategy System

MVP strategies should be limited and distinct.

Recommended:

### DIRECT_EXPLANATION
Clear conceptual explanation.

### SIMPLIFIED_EXPLANATION
Lower complexity and jargon.

### VISUAL_EXPLANATION
Uses diagram-oriented explanation or structured visual steps.

### ANALOGY
Uses a real-world analogy.

### WORKED_EXAMPLE
Teaches through a concrete worked example.

### SOCRATIC_GUIDANCE
Guides learner with questions instead of immediately explaining.

The system should not pretend that the same answer rewritten slightly is a new strategy.

---

## 7. Still Confused

Suggested state machine:

```text
ATTEMPT_1
  ↓ Still Confused
ATTEMPT_2_DIFFERENT_STRATEGY
  ↓ Still Confused
MINI_ASSESSMENT
  ↓
ANALYZE_RESULT
  ↓
PREREQUISITE_REMEDIATION or TEACHER_ESCALATION
```

Track:
- strategy used
- attempt number
- learner feedback
- outcome

---

## 8. Learner Twin

Possible stored signals per concept:

```text
mastery_score
mastery_confidence
attempt_count
success_count
failure_count
last_assessment_score
last_intervention
last_intervention_outcome
preferred_strategy
misconceptions
last_updated_at
```

Mastery is an estimate.

Do not use exact numbers in UI as if they are scientifically precise unless clearly presented as system estimates.

---

## 9. Mastery update

MVP mastery should be deterministic.

Example inputs:
- assessment correctness
- assessment difficulty
- recency
- teacher feedback
- intervention outcome

Possible simple approach:

```text
new_mastery =
    old_mastery * retention_weight
    + evidence_score * evidence_weight
```

Or bounded additive adjustments.

Keep logic explainable and testable.

---

## 10. Misconception tracking

Misconceptions may be:
- predefined for demo concepts
- detected by assessment patterns
- suggested by AI and validated against allowed values

For MVP, a predefined set for Computer Networks may be safer.

Example:
- LSDB_IS_ROUTING_TABLE
- OSPF_USES_HOP_COUNT
- RIP_IS_LINK_STATE

---

## 11. Root-Cause Learning

Root-Cause Learning combines:
- concept dependency graph
- low prerequisite mastery
- recent assessment evidence
- repeated failure on current concept

Example:

```text
OSPF weak
+
Link-State Routing mastery 36%
+
assessment error related to LSDB
→ prerequisite remediation
```

Do not claim perfect diagnosis.

---

## 12. Adaptive Practice

Question generation input:

```json
{
  "target_concept": "Link-State Routing",
  "mastery": 0.36,
  "difficulty": "BASIC",
  "misconceptions": ["LSDB_IS_ROUTING_TABLE"],
  "previous_questions": []
}
```

Question selection should adapt after every response.

For demo reliability:
- use seeded validated questions for the main path
- optionally generate additional questions dynamically

---

## 13. Assessment

Assessment types:
- MCQ
- short conceptual response
- explain-back

Hackathon recommendation:
- use MCQ / structured questions for the canonical demo
- use LLM evaluation only where necessary

Structured result:

```json
{
  "score": 0.33,
  "correct_count": 1,
  "total_count": 3,
  "detected_misconceptions": [
    "LSDB_IS_ROUTING_TABLE"
  ]
}
```

---

## 14. RAG

### Ingestion
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
```

### Query
```text
Question
 ↓
Embed
 ↓
Retrieve
 ↓
Filter by learner/document/subject
 ↓
Generate grounded answer
 ↓
Attach citations
```

Metadata should include:
- document_id
- document_name
- page_number
- chunk_index
- owner_id
- subject_id
- concept_id when known

---

## 15. Teacher Matching

Recommended MVP:
weighted scoring.

Potential factors:
- concept expertise
- subject expertise
- availability
- language
- teaching-style compatibility
- similar-case experience

Example:

```text
match =
0.40 * concept_expertise
+ 0.20 * subject_expertise
+ 0.15 * availability
+ 0.10 * language_match
+ 0.10 * style_match
+ 0.05 * outcome_score
```

Final weights should be approved in the implementation plan.

---

## 16. Teacher Copilot

Input:
- student
- question
- concept
- mastery
- attempts
- strategies
- assessment
- misconception
- prerequisite gap

Output:
- concise session brief
- recommended teaching approach

Teacher Copilot should summarize existing evidence, not fabricate learner history.

---

## 17. Prompt management

Production prompts should live in dedicated source files or a versioned prompt registry.

Every prompt should define:
- name
- purpose
- required inputs
- output schema
- version
- fallback behavior

Avoid scattering raw prompts through application code.

---

## 18. AI failure behavior

Handle:
- timeout
- invalid schema
- unknown concept
- low confidence
- refusal
- provider error

Fallback possibilities:
- deterministic response
- ask learner for clarification
- retry once
- teacher escalation
- show a friendly error

---

## 19. AI observability

Log:
- operation name
- model
- latency
- success/failure
- token usage if available
- schema validation result
- router decision
- reason codes

Do not log sensitive learner content unnecessarily.
