# NEXUS Seed Data

This document defines deterministic demo data.

Seed data should make the canonical OSPF scenario reliable.

---

## 1. Demo student

```yaml
name: Alex
role: STUDENT
preferred_language: English
preferred_teaching_strategies:
  - VISUAL_EXPLANATION
  - WORKED_EXAMPLE
```

---

## 2. Subject

```text
Computer Networks
```

---

## 3. Concepts

Suggested concepts:

1. OSI Model
2. TCP/IP
3. TCP
4. UDP
5. IP Addressing
6. Subnetting
7. Routing
8. Distance Vector Routing
9. RIP
10. Link-State Routing
11. Shortest Path
12. Dijkstra Algorithm
13. OSPF
14. LSDB
15. SPF Calculation
16. Routing Table
17. Neighbour Discovery
18. Network Topology

---

## 4. Concept dependencies

```text
IP Addressing → Subnetting
Routing → Distance Vector Routing
Distance Vector Routing → RIP
Routing → Link-State Routing
Shortest Path → Dijkstra Algorithm
Dijkstra Algorithm → Link-State Routing
Link-State Routing → OSPF
LSDB → OSPF
SPF Calculation → OSPF
```

Final graph should remain simple enough to explain.

---

## 5. Learner concept state

Recommended deterministic demo values:

| Concept | Mastery |
|---|---:|
| TCP/IP | 91% |
| Subnetting | 72% |
| Routing | 43% |
| Link-State Routing | 36% |
| OSPF | 31% |
| LSDB | 28% |
| SPF Calculation | 38% |

These are demo estimates.

---

## 6. Known misconception

Code:

`LSDB_IS_ROUTING_TABLE`

Description:

Learner treats the Link-State Database as equivalent to the final routing table.

Concept:
OSPF / Link-State Routing.

---

## 7. Prior learning history

Seed enough history to support personalization.

Example:

### Previous intervention
Concept:
Routing

Strategy:
DIRECT_EXPLANATION

Outcome:
STILL_CONFUSED

### Previous intervention
Concept:
Subnetting

Strategy:
VISUAL_EXPLANATION

Outcome:
UNDERSTOOD

This supports a visual strategy preference.

---

## 8. Teachers

### Teacher 1 — Priya Sharma

```yaml
concept_expertise:
  OSPF: 0.98
  Link-State Routing: 0.95
  Routing: 0.90
teaching_style: VISUAL
language: English
availability: AVAILABLE
rating: 4.9
```

### Teacher 2 — Rahul Verma

```yaml
concept_expertise:
  OSPF: 0.78
  Routing: 0.85
teaching_style: SOCRATIC
language: English
availability: LATER
rating: 4.7
```

### Teacher 3 — Meera Iyer

```yaml
concept_expertise:
  OSPF: 0.92
  Link-State Routing: 0.88
teaching_style: WORKED_EXAMPLE
language: English
availability: AVAILABLE
rating: 4.8
```

---

## 9. Demo assessment

Canonical 3-question assessment should be deterministic.

Question 1:
What does OSPF use to calculate shortest paths?

Correct:
SPF / Dijkstra.

Question 2:
Is the LSDB the same as the final routing table?

Correct:
No.

Question 3:
What is the purpose of link-state advertisements?

Correct:
Share topology/link-state information.

Demo student should answer 1 of 3 correctly.

---

## 10. Study material

Provide one demo PDF or equivalent with sections on:
- Link-State Routing
- OSPF
- LSDB
- SPF
- Routing Table

Ensure indexed citations are stable before demo.
