# NEXUS Frontend Specification

## 1. Design goals

The UI should feel:
- intelligent
- modern
- colorful
- premium
- futuristic
- student-friendly

Suggested visual direction:
- purple
- blue
- cyan
- magenta
- selective orange accents
- gradients
- glass-like cards
- soft glows
- concept graphs
- interactive visualizations

Primary rule:

**CLARITY > DECORATION**

---

## 2. Student navigation

Suggested main navigation:

```text
Home
Ask NEXUS
Practice
Learner Twin
Materials
Progress
```

Teacher assistance may appear contextually rather than as a top-level tab.

---

## 3. Login / Role Selection

Purpose:
allow student and teacher entry.

Hackathon priority:
simple and reliable.

Avoid spending time on complex onboarding.

---

## 4. Student Home

Primary question:

> What should I learn next?

Components:
- personalized recommendation
- weak concept card
- continue learning
- recent activity
- learner progress snapshot

Example:

```text
Good morning, Alex

NEXUS recommends:
Routing needs attention

Mastery:
43%

Recommended:
8-minute visual revision
```

---

## 5. Ask NEXUS

MVP:
- text question input

Stretch:
- image
- voice
- attached study material

AI progress states:

```text
Understanding your doubt...
Detecting concept...
Checking learner history...
Checking prerequisites...
Selecting learning strategy...
```

Do not show hidden reasoning.

---

## 6. Resolution Workspace

Must show:
- detected concept
- selected teaching strategy
- concise reason
- explanation
- relevant source citations
- I Understand
- Still Confused
- Test My Understanding

Potential header:

```text
NEXUS selected:
Visual Explanation

Why?
Visual explanations have worked better for similar concepts in your learner history.
```

---

## 7. Still Confused UX

When selected:
1. acknowledge the signal
2. visibly show strategy change
3. avoid repeating the same format
4. optionally explain why the strategy changed

Example:

```text
That approach didn't work.

Switching from:
Direct Explanation

to:
Worked Example
```

---

## 8. Adaptive Practice

Display:
- target concept
- question number
- difficulty
- question
- answer controls
- feedback
- why next question changed when useful

Example:

```text
NEXUS noticed:
You understand OSPF basics but appear unsure about LSDB usage.

Next question:
Link-State Database
```

---

## 9. Learner Twin

This should be one of the strongest visual pages.

Show:
- concept hierarchy
- mastery
- weak concepts
- strong concepts
- misconceptions
- strategy preference
- recommended next step

Example:

```text
Computer Networks
      │
      ├─ TCP/IP 91%
      ├─ Routing 43%
      │    ├─ RIP 74%
      │    └─ OSPF 31%
      └─ Security 67%
```

Avoid implying false scientific precision.

---

## 10. Study Materials

Allow:
- upload
- processing
- indexed state
- failure state
- file list
- source metadata

Possible status:
- Uploading
- Processing
- Indexed
- Failed

---

## 11. Teacher Match

Display:
- teacher
- expertise
- availability
- match score
- concise reason

Example:

```text
Priya Sharma

96% match

Why NEXUS selected this teacher:
✓ OSPF specialist
✓ Strong with visual learners
✓ Available now
```

---

## 12. Teacher Dashboard

Show:
- pending escalations
- upcoming sessions
- recent learners
- relevant concept

Prioritize context over generic dashboards.

---

## 13. Student Intelligence / Teacher Copilot

Show:
- original question
- concept
- mastery
- strategies attempted
- assessment score
- misconception
- prerequisite gap
- recommended teaching strategy

---

## 14. Teacher Session

Hackathon-safe options:
- simulated connection
- chat
- simple session status
- external meeting link

Do not build video unless there is enough time.

---

## 15. Progress

Useful metrics:
- concept mastery trend
- completed interventions
- assessment improvement
- resolved doubts
- topics needing attention

Avoid fake production metrics.

---

## 16. Critical UI states

Every AI-driven area should define:

- idle
- loading
- analyzing
- low confidence
- success
- empty
- error
- retry
- fallback

Important examples:

### Low confidence
```text
I think this is related to OSPF, but I need a little more context.
```

### No RAG evidence
```text
I couldn't find this in your uploaded notes, so I'll answer using general knowledge.
```

Only show that behavior if allowed by product design.

---

## 17. Make intelligence visible

Good:

```text
Detected concept:
OSPF

Current mastery:
31%

Previous attempts:
2

Selected:
Visual Explanation
```

Avoid:

```text
Loading...
```

as the only feedback.

---

## 18. Accessibility

At minimum:
- sufficient contrast
- keyboard-accessible controls
- readable font sizes
- color not used as the only meaning
- loading states announced where practical
