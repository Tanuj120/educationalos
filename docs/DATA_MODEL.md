# NEXUS Data Model

> Exact SQL schema should be finalized in the approved implementation plan.

This document defines the domain model and expected relationships.

---

## 1. User

Common identity.

Potential fields:
- id
- email
- password_hash or external_auth_id
- role
- created_at
- updated_at

Role examples:
- STUDENT
- TEACHER

---

## 2. StudentProfile

Purpose:
student-specific preferences and profile state.

Potential fields:
- user_id
- display_name
- preferred_language
- preferred_teaching_strategy
- created_at
- updated_at

---

## 3. TeacherProfile

Potential fields:
- user_id
- display_name
- bio
- language
- availability_status
- teaching_style
- rating
- created_at

---

## 4. Subject

Example:
Computer Networks

Potential fields:
- id
- name
- slug
- description

---

## 5. Concept

Example:
OSPF

Potential fields:
- id
- subject_id
- name
- slug
- description
- difficulty_level

---

## 6. ConceptDependency

Represents prerequisite edges.

Example:

```text
Link-State Routing → OSPF
```

Potential fields:
- id
- prerequisite_concept_id
- dependent_concept_id
- strength or importance
- created_at

---

## 7. TeacherExpertise

Maps teacher to concept/subject expertise.

Potential fields:
- id
- teacher_id
- subject_id
- concept_id
- expertise_score
- years_experience or evidence label

---

## 8. Doubt

Represents a learner question.

Potential fields:
- id
- student_id
- question_text
- subject_id
- concept_id
- difficulty
- status
- ai_confidence
- created_at
- resolved_at

---

## 9. Conversation

Optional grouping for doubt-related messages.

Potential fields:
- id
- student_id
- doubt_id
- status
- created_at

---

## 10. Message

If chat-style interaction is implemented.

Potential fields:
- id
- conversation_id
- sender_type
- content
- metadata_json
- created_at

---

## 11. LearningIntervention

Records a router decision.

Potential fields:
- id
- doubt_id
- student_id
- target_concept_id
- intervention_type
- teaching_strategy
- attempt_number
- reason_codes_json
- status
- created_at
- completed_at

Important:
This entity is central for explainability and demo history.

---

## 12. InterventionFeedback

Potential fields:
- id
- intervention_id
- student_id
- feedback_type
- created_at

Feedback examples:
- UNDERSTOOD
- STILL_CONFUSED
- REQUEST_PRACTICE
- REQUEST_TEACHER

---

## 13. LearnerConceptState

Current estimated state for one student and one concept.

Potential fields:
- id
- student_id
- concept_id
- mastery_score
- mastery_confidence
- preferred_strategy
- attempts
- successes
- failures
- last_assessment_score
- last_updated_at

Unique constraint:
- student_id + concept_id

---

## 14. Misconception

Canonical misconception definitions.

Potential fields:
- id
- concept_id
- code
- name
- description

Example:
`LSDB_IS_ROUTING_TABLE`

---

## 15. LearnerMisconception

Links a learner to a detected misconception.

Potential fields:
- id
- student_id
- concept_id
- misconception_id
- confidence
- evidence_count
- status
- first_detected_at
- last_detected_at

---

## 16. Assessment

Potential fields:
- id
- student_id
- doubt_id
- target_concept_id
- type
- status
- created_at
- completed_at
- score

---

## 17. AssessmentQuestion

Potential fields:
- id
- assessment_id
- concept_id
- question_type
- question_text
- difficulty
- options_json
- correct_answer_json
- explanation

---

## 18. AssessmentResponse

Potential fields:
- id
- assessment_question_id
- student_id
- response_json
- is_correct
- score
- detected_misconception_id
- created_at

---

## 19. LearningMaterial

Uploaded learner material.

Potential fields:
- id
- student_id
- file_name
- mime_type
- storage_key
- status
- page_count
- subject_id
- created_at

Status:
- UPLOADED
- PROCESSING
- INDEXED
- FAILED

---

## 20. DocumentChunk

Potential fields:
- id
- material_id
- chunk_index
- page_number
- text
- embedding reference/vector
- subject_id
- concept_id

---

## 21. TeacherMatch

Records teacher ranking for an escalation.

Potential fields:
- id
- student_id
- doubt_id
- teacher_id
- match_score
- reason_codes_json
- rank
- created_at

---

## 22. TeacherSession

Potential fields:
- id
- student_id
- teacher_id
- doubt_id
- status
- started_at
- ended_at
- session_type
- outcome
- teacher_feedback
- mastery_delta

---

## 23. Recommendation

Optional record of "what to learn next".

Potential fields:
- id
- student_id
- concept_id
- recommendation_type
- reason_codes_json
- status
- created_at

---

## 24. AgentDecision / SystemDecision

Optional audit table.

Potential fields:
- id
- student_id
- doubt_id
- decision_type
- input_summary_json
- output_json
- reason_codes_json
- confidence
- created_at

Use only if it adds value beyond LearningIntervention.

---

## 25. InteractionEvent

Optional analytics stream/table.

Potential fields:
- id
- student_id
- event_type
- entity_type
- entity_id
- properties_json
- created_at

Avoid overengineering event architecture.

---

## 26. Relationship sketch

```text
User
├── StudentProfile
│   ├── Doubt
│   │   ├── LearningIntervention
│   │   │   └── InterventionFeedback
│   │   └── Assessment
│   │       ├── AssessmentQuestion
│   │       └── AssessmentResponse
│   ├── LearnerConceptState
│   │   └── Concept
│   ├── LearnerMisconception
│   ├── LearningMaterial
│   │   └── DocumentChunk
│   ├── TeacherMatch
│   └── TeacherSession
└── TeacherProfile
    ├── TeacherExpertise
    └── TeacherSession

Subject
└── Concept
    ├── ConceptDependency
    └── Misconception
```

---

## 27. Important data questions

The schema must support:

- what did the learner ask?
- what concept was detected?
- what did NEXUS know about the learner?
- what intervention was selected?
- why was it selected?
- what strategy was used?
- did it work?
- what assessment followed?
- what mistake was made?
- was a prerequisite gap detected?
- was a teacher required?
- what changed in the Learner Twin?
