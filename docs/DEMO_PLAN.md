# NEXUS Hackathon Demo Plan

## 1. Demo objective

Prove that NEXUS does more than answer questions.

The demo should show that NEXUS:
- understands the learner
- changes teaching strategy
- measures learning
- detects prerequisite gaps
- knows when AI is insufficient
- connects the learner to human help
- updates future personalization

---

## 2. Demo student

Name:
Alex

Subject:
Computer Networks

Learner Twin:

```text
TCP/IP               91%
Subnetting            72%
Routing               43%
Link-State Routing    36%
OSPF                  31%
```

Preferred strategies:
- Visual Explanation
- Worked Example

Known misconception:
- Confuses LSDB with the final routing table

---

## 3. Demo teachers

### Priya Sharma
- OSPF specialist
- visual teaching
- available now

### Rahul Verma
- general networking
- Socratic style
- available later

### Meera Iyer
- routing specialist
- worked-example style
- available now

---

## 4. Demo question

Student asks:

> How does OSPF select the shortest path?

---

## 5. Scene 1 — Ask NEXUS

NEXUS shows:

```text
Detected Subject:
Computer Networks

Detected Concept:
OSPF

Current Mastery:
31%

Preferred Strategy:
Visual

Selecting the best intervention...
```

Router decision:

`VISUAL_EXPLANATION`

---

## 6. Scene 2 — First explanation

NEXUS presents a visual explanation.

Student selects:

`Still Confused`

---

## 7. Scene 3 — Strategy Switching

NEXUS shows:

```text
That approach didn't work.

Switching strategy:
Visual Explanation
→ Worked Example
```

NEXUS presents a worked topology example.

Student selects:

`Still Confused`

---

## 8. Scene 4 — Assessment

NEXUS says:

> Let's test which part is unclear.

Three-question assessment.

Canonical demo result:

```text
1 / 3 correct
```

Detected misconception:

`LSDB_IS_ROUTING_TABLE`

---

## 9. Scene 5 — Root-Cause Learning

NEXUS shows:

```text
Your difficulty with OSPF may come from an earlier concept:

Link-State Routing
```

Router decision:

`PREREQUISITE_REMEDIATION`

---

## 10. Scene 6 — Remediation

Give short prerequisite remediation.

Option A:
learner still struggles.

Option B:
demo intentionally uses continued low score.

---

## 11. Scene 7 — Human Escalation

Router decision:

`HUMAN_TEACHER_ESCALATION`

Reason codes:

```text
MULTIPLE_FAILED_ATTEMPTS
LOW_ASSESSMENT_SCORE
PREREQUISITE_REMEDIATION_INSUFFICIENT
```

---

## 12. Scene 8 — Teacher Matching

Show 3 teachers.

NEXUS ranks Priya first.

Example:

```text
Priya Sharma
96% match

Why:
✓ OSPF specialist
✓ visual teaching match
✓ experience with similar misconception
✓ available now
```

---

## 13. Scene 9 — Teacher Copilot

Switch to teacher view.

Display:

```text
Student:
Alex

Question:
How does OSPF select the shortest path?

OSPF mastery:
31%

Previous attempts:
1. Visual Explanation
2. Worked Example
3. Assessment — 33%

Detected misconception:
LSDB vs Routing Table

Prerequisite concern:
Link-State Routing

Recommended approach:
Use a three-router topology and walk through:
LSDB → SPF → Routing Table
```

---

## 14. Scene 10 — Session completion

Teacher completes session.

Feedback:

```text
Outcome:
Improved

Teacher note:
Student understood after topology walkthrough.
```

---

## 15. Scene 11 — Learner Twin update

Show:

```text
OSPF
31% → 46%
```

Or another approved deterministic update.

End with:

> NEXUS didn't just answer the question. It discovered what the learner needed.

---

## 16. Demo hardening requirements

Before presentation:
- reset demo state
- verify seed data
- verify OSPF path
- verify AI provider
- verify fallback
- verify teacher profiles
- verify document index
- run smoke test
- keep local backup if deployment fails
