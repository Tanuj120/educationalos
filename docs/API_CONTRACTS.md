# NEXUS API Contracts

> Exact payloads are drafts until implementation planning is approved.

Prefer predictable REST APIs.

AI-heavy responses may support streaming.

---

## 1. Auth

### POST `/auth/register`

### POST `/auth/login`

### GET `/auth/me`

---

## 2. Student profile

### GET `/students/me`

### GET `/students/me/dashboard`

Possible dashboard response:

```json
{
  "student": {
    "id": "stu_1",
    "name": "Alex"
  },
  "recommendation": {
    "concept": "Routing",
    "mastery": 0.43,
    "action": "VISUAL_REVISION"
  },
  "weak_concepts": [],
  "recent_activity": []
}
```

---

## 3. Doubts

### POST `/doubts`

Request:

```json
{
  "question": "How does OSPF select the shortest path?",
  "subject_id": "computer-networks"
}
```

Response:

```json
{
  "doubt_id": "doubt_1",
  "status": "ANALYZING"
}
```

### GET `/doubts/{id}`

Returns current doubt state.

---

## 4. Doubt analysis

### POST `/doubts/{id}/analyze`

Possible response:

```json
{
  "subject": "Computer Networks",
  "concept": "OSPF",
  "difficulty": "INTERMEDIATE",
  "confidence": 0.92,
  "possible_prerequisite": "Link-State Routing"
}
```

This may be automatically triggered by doubt creation.

---

## 5. Learning Router

### POST `/doubts/{id}/route`

Response:

```json
{
  "intervention_id": "int_1",
  "intervention": "VISUAL_EXPLANATION",
  "target_concept": "OSPF",
  "reason_codes": [
    "LOW_MASTERY",
    "VISUAL_STRATEGY_EFFECTIVE"
  ]
}
```

---

## 6. Intervention content

### POST `/interventions/{id}/generate`

Response:

```json
{
  "strategy": "VISUAL_EXPLANATION",
  "content": {
    "title": "How OSPF Finds the Shortest Path",
    "body": "...",
    "visual_steps": []
  },
  "sources": []
}
```

May support streaming.

---

## 7. Intervention feedback

### POST `/interventions/{id}/feedback`

Request:

```json
{
  "feedback": "STILL_CONFUSED"
}
```

Possible response:

```json
{
  "next_action": "SWITCH_STRATEGY"
}
```

Feedback types may include:
- UNDERSTOOD
- STILL_CONFUSED
- TEST_ME
- REQUEST_TEACHER

---

## 8. Assessments

### POST `/assessments`

Request:

```json
{
  "doubt_id": "doubt_1",
  "concept_id": "ospf",
  "question_count": 3
}
```

### GET `/assessments/{id}`

### POST `/assessments/{id}/responses`

Request:

```json
{
  "responses": [
    {
      "question_id": "q1",
      "answer": "B"
    }
  ]
}
```

Response:

```json
{
  "score": 0.33,
  "correct": 1,
  "total": 3,
  "misconceptions": [
    "LSDB_IS_ROUTING_TABLE"
  ],
  "recommended_next_action": "PREREQUISITE_REMEDIATION"
}
```

---

## 9. Learner Twin

### GET `/students/me/learner-twin`

Possible response:

```json
{
  "subject": "Computer Networks",
  "concepts": [
    {
      "id": "ospf",
      "name": "OSPF",
      "mastery": 0.31,
      "confidence": 0.74
    }
  ],
  "misconceptions": [],
  "preferred_strategies": [
    "VISUAL_EXPLANATION",
    "WORKED_EXAMPLE"
  ]
}
```

### GET `/students/me/concepts/{concept_id}`

---

## 10. Materials

### POST `/materials`

Multipart upload.

### GET `/materials`

### GET `/materials/{id}`

### DELETE `/materials/{id}`

Possible material status:

```json
{
  "status": "INDEXED"
}
```

---

## 11. RAG query

Usually internal to an intervention.

If exposed:

### POST `/materials/search`

Request:

```json
{
  "query": "What do my notes say about OSPF SPF calculation?",
  "concept_id": "ospf"
}
```

---

## 12. Teacher matching

### POST `/teacher-matches`

Request:

```json
{
  "doubt_id": "doubt_1"
}
```

Response:

```json
{
  "matches": [
    {
      "teacher_id": "teacher_1",
      "match_score": 0.96,
      "rank": 1,
      "reason_codes": [
        "OSPF_EXPERT",
        "VISUAL_STYLE_MATCH",
        "AVAILABLE_NOW"
      ]
    }
  ]
}
```

---

## 13. Teacher sessions

### POST `/teacher-sessions`

### GET `/teacher-sessions/{id}`

### POST `/teacher-sessions/{id}/complete`

Request:

```json
{
  "outcome": "IMPROVED",
  "teacher_feedback": "Student understood after topology walkthrough.",
  "concept_mastery_signal": 0.7
}
```

---

## 14. Teacher dashboard

### GET `/teachers/me/dashboard`

### GET `/teachers/me/students/{student_id}/context`

Should return the Teacher Copilot context.

---

## 15. Analytics

### GET `/students/me/progress`

### GET `/students/me/activity`

Do not build analytics endpoints unless the UI genuinely uses them.

---

## 16. API rules

- use stable error shape
- validate all AI-derived enums
- include IDs for traceability
- avoid exposing provider-specific AI payloads
- document streaming separately if used
