# NEXUS — The AI Learning Orchestrator

> **The right help. At the right time. For every learner.**

NEXUS is an AI-native education platform built for **The Industry Games 2026 Hackathon** — District 03 Challenge: *AI-Native Education OS for Intelligent Doubt Resolution*, sponsored by **AtomTalk**.

It is not a chatbot. NEXUS is a full **learning orchestration system** that understands a student's doubt, consults their learning history, selects the best teaching strategy, measures understanding, and adapts over time.

---

## Table of Contents

- [What Makes NEXUS Different](#what-makes-nexus-different)
- [Core Loop](#core-loop)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start (Docker)](#quick-start-docker)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Demo Journey](#demo-journey)
- [API Reference](#api-reference)
- [Development](#development)
- [Architecture](#architecture)

---

## What Makes NEXUS Different

A typical AI tutor does this:

```
Student question → LLM → Answer
```

NEXUS does this:

```
Student question
      ↓
Understand the doubt
      ↓
Load the Learner Twin (mastery, history, misconceptions)
      ↓
Learning Router selects the best intervention
      ↓
Teach with the right strategy
      ↓
Measure understanding (quiz / feedback)
      ↓
Update the Learner Twin
      ↓
Make a better decision next time
```

---

## Core Loop

```
UNDERSTAND → DECIDE → TEACH → MEASURE → LEARN → ADAPT
```

---

## Features

### Student

| Feature | Description |
|---|---|
| **Ask NEXUS** | Ask any doubt in plain language. NEXUS detects the concept, loads your learner profile, and selects the best explanation strategy. |
| **Still Confused** | Not just a "regenerate" — triggers strategy switching (analogy → worked example → prerequisite check). |
| **Adaptive Quiz** | 4-option quiz generated from your PDFs. Questions target your weakest topics. Wrong answers feed back into future explanations. |
| **Learner Twin** | A live view of your concept mastery across all courses — updated after every quiz, confusion signal, and correct answer. |
| **Study Materials** | Upload PDFs per course unit. NEXUS chunks, embeds, and indexes them for RAG-grounded answers. |
| **Smart Notes** | AI-generated structured notes from your PDFs: key concepts, definitions, flashcards, exam points. |
| **Teacher Copilot** | Browse available teachers, view your escalated meetings, and join live Google Meet sessions. |
| **YouTube Recommendations** | On-demand video recommendations fetched via YouTube Data API v3 after any answer. |
| **Live AI Tutor** | Voice-enabled real-time learning session with transcript and concept gap analysis. |
| **Labs** | Interactive concept explorer for hands-on practice. |

### Teacher

| Feature | Description |
|---|---|
| **Teacher Dashboard** | View all escalated student doubts with full context. |
| **Teacher Copilot Brief** | Before a session, see the student's original question, detected concept, mastery, previous AI attempts, and recommended teaching approach. |
| **Google Meet Integration** | Create a shared meeting room directly from an escalation. |
| **Video Lectures** | Upload or link video lessons that students can discover in their Teacher Copilot page. |
| **Session Review** | Mark sessions complete; students can rate and provide feedback. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Vanilla CSS |
| **Backend** | FastAPI (Python 3.11), Uvicorn |
| **Database** | PostgreSQL 16 + pgvector |
| **AI / LLM** | Google Gemini (`gemini-2.0-flash`, `gemini-embedding-001`) via `google-genai` SDK |
| **PDF Parsing** | PyMuPDF (`pymupdf`) |
| **ORM** | SQLAlchemy 2.0 |
| **Containerisation** | Docker + Docker Compose |
| **External APIs** | YouTube Data API v3, Google Meet REST API, Google OAuth 2.0 |

---

## Project Structure

```
nexus/
├── backend/
│   ├── app/
│   │   ├── main.py          # All FastAPI routes, models, and business logic
│   │   └── youtube.py       # YouTube Data API v3 recommendation service
│   ├── tests/               # Backend test suite
│   ├── uploads/             # Uploaded PDF storage (bind-mounted)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Full single-file React application
│   │   ├── styles.css       # Complete design system and component styles
│   │   └── youtubeRecommendations.js
│   ├── assets/
│   ├── index.html
│   ├── vite.config.js
│   └── Dockerfile
├── docs/                    # Architecture and implementation planning docs
├── scripts/                 # Helper scripts (image pull, etc.)
├── docker-compose.yml       # Full stack orchestration
├── .env.example             # Environment variable template
├── start-nexus.bat          # One-click Windows launcher
└── AGENTS.md                # AI agent operating guide for this repo
```

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

### 1. Clone and configure

```bash
git clone <repo-url>
cd "AI Native Education OS"
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here          # Optional
GOOGLE_MEET_CLIENT_ID=your_google_oauth_client_id  # Optional
```

### 2. Start the full stack

**Windows — one click:**

```
start-nexus.bat
```

**Or manually:**

```bash
docker compose up --build -d
```

### 3. Open the app

| Service | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **API** | http://localhost:8001 |
| **API Docs** | http://localhost:8001/docs |
| **Health check** | http://localhost:8001/health |

### 4. Stop the stack

```bash
docker compose down          # Keeps your data
docker compose down -v       # Also removes the database volume
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key for chat and embeddings |
| `GEMINI_CHAT_MODEL` | No | `gemini-2.0-flash` | Chat model name |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Embedding model (1536 dimensions) |
| `EMBEDDING_RETRY_AFTER_SECONDS` | No | `300` | Backoff after embedding quota error |
| `YOUTUBE_API_KEY` | No | — | YouTube Data API v3 key for video recommendations |
| `YOUTUBE_CACHE_TTL_SECONDS` | No | `900` | In-memory YouTube result cache duration |
| `GOOGLE_MEET_CLIENT_ID` | No | — | Google OAuth Client ID for Meet integration |
| `DATABASE_URL` | No | `sqlite:///./nexus.db` | PostgreSQL URL (set automatically in Docker) |

> Without `GEMINI_API_KEY`, the app runs but answers show a configuration message. Materials are saved but marked `PARSED_AWAITING_EMBEDDINGS` and lexical retrieval is used as fallback.

---

## Demo Accounts

### Student

Create any student account via the Sign Up screen (choose **Student** role).

**Demo student profile:**

```
Name:  Alex

Concept mastery:
  TCP/IP               91%
  Subnetting           72%
  Routing              43%
  Link-State Routing   36%
  OSPF                 31%

Known misconception: Confuses LSDB with the final routing table
```

### Teachers (pre-seeded — password: `Teacher@123`)

| Name | Email | Subjects | Rating |
|---|---|---|---|
| Priya Sharma | priya.sharma@gmail.com | Computer Networks, Data Structures, OS | ⭐ 4.8 |
| Raghav Kumar | raghav.kumar@gmail.com | Database Systems, Software Engineering, Maths | ⭐ 4.6 |
| Ananya Iyer | ananya.iyer@gmail.com | Mathematics, Physics, Data Structures | ⭐ 4.9 |
| Vikram Nair | vikram.nair@gmail.com | Operating Systems, Networks, Software Engineering | ⭐ 4.7 |
| Meera Reddy | meera.reddy@gmail.com | Database Systems, Mathematics, Physics | ⭐ 4.5 |

---

## Demo Journey

The canonical hackathon demo path:

1. Student asks an **OSPF** question in Ask NEXUS
2. NEXUS detects the concept and loads the Learner Twin
3. Learning Router chooses a personalized explanation (visual — based on learner profile)
4. Student clicks **Still Confused**
5. NEXUS switches teaching strategy (analogy / worked example)
6. Student takes a **mini quiz**
7. Student scores poorly — NEXUS detects a **prerequisite gap** (Link-State Routing)
8. NEXUS recommends **prerequisite remediation**
9. Continued failure triggers **teacher escalation**
10. Teacher matching runs — teacher receives a **Session Brief**
11. Teacher joins via **Google Meet**
12. Session is reviewed → **Learner Twin updates**
13. Future recommendations reflect the session outcome

---

## API Reference

Full interactive docs: **http://localhost:8001/docs**

### Endpoint groups

| Group | Base path | Description |
|---|---|---|
| Courses | `/api/v1/courses` | Create, list, update, delete courses |
| Units | `/api/v1/courses/{id}/units` | Manage course units |
| Materials | `/api/v1/materials` | Upload PDFs, trigger reindex |
| Ask / Chat | `/api/v1/ask`, `/api/v1/ask/stream` | RAG-grounded Q&A (streaming SSE) |
| Quiz | `/api/v1/quiz` | Generate and answer adaptive quiz questions |
| Progress | `/api/v1/progress` | Topic mastery signals |
| Learner Twin | `/api/v1/learner-twin` | Full learner state |
| Notes | `/api/v1/notes` | AI-generated structured notes |
| Teachers | `/api/v1/teachers` | Teacher directory |
| Teacher Copilot | `/api/v1/teacher/escalations`, `/api/v1/teacher/copilot-brief/{id}` | Escalation management and session briefs |
| Meetings | `/api/v1/teacher-meetings/{id}/google-meet` | Create / retrieve Google Meet rooms |
| Videos | `/api/v1/teacher/videos`, `/api/v1/video-lectures/library` | Teacher video uploads and student library |
| YouTube | `/api/v1/youtube/recommendations` | On-demand video recommendations |
| Live Sessions | `/api/v1/live-sessions` | Voice tutor session records |
| Health | `/health` | Server health check |

### Auth headers (temporary, pre-JWT)

```
X-User-ID:   user-<email>       # student identity
X-User-ID:   teacher-<email>    # teacher identity
X-User-Role: student | teacher
```

---

## Development

### Hot reload

- **Backend:** changes to `backend/app/` auto-restart Uvicorn via `watchfiles`
- **Frontend:** changes to `frontend/src/` instantly apply via Vite HMR

No container restart needed for code changes.

### Rebuild after dependency changes

```bash
docker compose up --build -d
```

### View logs

```bash
docker compose logs -f              # All services
docker compose logs -f backend      # Backend only
docker compose logs -f frontend     # Frontend only
```

### Run backend tests

```bash
docker compose exec backend python -m pytest tests/ -v
```

### Reindex a PDF

```bash
curl -X POST http://localhost:8001/api/v1/materials/<material_id>/reindex \
  -H "X-User-ID: user-example"
```

---

## Architecture

### Learning Router

Routing decisions use structured signals — not an unconstrained LLM prompt:

```
Concept mastery + prerequisite mastery + confusion count
+ previous strategies + assessment score + student preference
                      ↓
              Deterministic scoring
                      ↓
          DIRECT_EXPLANATION       ANALOGY
          SIMPLIFIED_EXPLANATION   VISUAL_EXPLANATION
          WORKED_EXAMPLE           SOCRATIC_GUIDANCE
          ADAPTIVE_PRACTICE        PREREQUISITE_REMEDIATION
          HUMAN_TEACHER_ESCALATION
```

Every routing decision includes a concise **reason** shown to the student.

### Learner Twin

Per-topic mastery score updated after every learning event:

| Signal | Mastery delta |
|---|---|
| Quiz correct | +18 |
| Quiz incorrect | −18 |
| I understand | +6 |
| Still confused | −12 |

Topics below **70%** → `NEEDS_PRACTICE`. Topics above **70%** → `IMPROVING`.

### RAG Pipeline

```
PDF upload
    → PyMuPDF text extraction
    → Chunk (1800 chars, 240 char overlap)
    → Gemini embed (1536 dimensions, gemini-embedding-001)
    → Store in pgvector (PostgreSQL)
    → Cosine similarity retrieval on student query
    → Grounded answer via Gemini chat model
    → Source citations shown to student
```

**Fallback:** Lexical keyword retrieval is used when embeddings are unavailable (no API key or quota exceeded). No fabricated citations are ever returned.

---

## Hackathon

| | |
|---|---|
| **Event** | The Industry Games 2026 |
| **Challenge** | District 03 — AI-Native Education OS for Intelligent Doubt Resolution |
| **Sponsor** | AtomTalk |
| **Tagline** | *The right help. At the right time. For every learner.* |


The development stack runs entirely in Docker:

- React + Vite frontend
- FastAPI backend
- PostgreSQL 16 with pgvector

The source directories are bind-mounted into the containers. Changes under `frontend/` update through Vite hot reload, while changes under `backend/` restart FastAPI automatically.

## Start the complete stack

On Windows, double-click `start-nexus.bat`. It starts the frontend, backend, and database, automatically downloading only images that are missing, then opens the site at `http://localhost:3000`.

To pre-download or refresh the Docker images without starting the application (requires a Docker Hub connection), run:

```powershell
.\scripts\pull-docker-images.ps1
```

Or start the stack manually:

```powershell
docker compose up --build -d
docker compose ps
```

Open:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8001`
- API documentation: `http://localhost:8001/docs`
- API health: `http://localhost:8001/health`

View logs with `docker compose logs -f`. Stop the stack with `docker compose down`. PostgreSQL data remains in the `nexus_postgres_data` volume.

## PDF vector ingestion

The material hierarchy is:

`Course → custom unit → one or more PDFs → text chunks → pgvector embeddings`

To enable real embeddings, copy `.env.docker.example` to `.env`, add a `GEMINI_API_KEY`, and recreate the backend:

```powershell
docker compose up -d --force-recreate backend
```

NEXUS sends extracted text chunks to Gemini's `gemini-embedding-001` model with a fixed 1,536 dimensions, then stores each returned vector in PostgreSQL's `pgvector` column. Ask NEXUS uses `gemini-3.8-flash`: select a course and unit, and it retrieves the most relevant chunks across every PDF in that unit before answering. Without an API key, materials are marked `PARSED_AWAITING_EMBEDDINGS` instead of falsely claiming embeddings were created. Existing uploads can be reprocessed through `POST /api/v1/materials/{material_id}/reindex`.

API ownership currently uses the temporary `X-User-ID` header until full authentication is connected.

## YouTube learning recommendations

After NEXUS completes a RAG answer, the student can select **Find Related Videos** beneath that specific response. Recommendations are fetched only on demand through the backend using the official YouTube Data API v3. Results are cached in memory by normalized query for 15 minutes by default, so reopening a section does not consume more quota.

To enable the feature:

1. Enable **YouTube Data API v3** in a Google Cloud project and create an API key.
2. Copy `.env.example` to `.env` if needed and set `YOUTUBE_API_KEY` to that key.
3. Restrict the key to the YouTube Data API in Google Cloud.
4. Recreate the backend so it receives the environment variable:

```powershell
docker compose up -d --force-recreate backend
```

`YOUTUBE_CACHE_TTL_SECONDS` optionally changes the in-memory cache duration. The key is never sent to the browser. If the API is unavailable, misconfigured, rate-limited, or out of quota, the RAG answer continues to work and the recommendation section presents a retryable error.

## Conversation memory and practice

Successful Ask NEXUS turns are stored in PostgreSQL (`chat_turns`) and remain available after browser refreshes or container restarts. The UI imports matching older browser chat once, then reads history from the API. The `All chats` control also shows turns from courses or units that were later removed.

For a new question, NEXUS sends the most recent turns from the selected unit, a small number of older turns about the same topic, and the learner's recorded weak topics to Gemini along with the relevant PDF material. A `Still confused` action lowers the estimated topic strength and asks for a different explanation. `I understand` is a light positive signal. A generated four-option quiz is graded server-side; wrong answers and the chosen option are stored, and subsequent explanations receive those mistakes as context. Repeated correct answers can raise a topic above the focus threshold of 70%. The score is an estimate, not proof of mastery.

The records live in the `nexus_postgres_data` Docker volume. `docker compose down` keeps that volume; `docker compose down -v` removes it. Current sign-in is local UI state and all frontend API calls still use the temporary `local-user` identity, so multi-account isolation needs real authentication before use beyond the local demo.

Each course unit now has a **Practice unit** entry in Materials and a **Start unit quiz** action in Ask NEXUS. A quiz can start from the unit's PDFs without a prior chat, including scanned PDFs read through Gemini. The backend chooses a recorded weak topic first, stores every answer, and includes recent mistakes when creating the next question. Difficulty follows the unit's estimated topic strength: below 55% is foundational, 55–74% is intermediate, and 75% or above is advanced. A correct answer adds 18 points; a wrong answer removes 18. These values are simple learning estimates for the local MVP.
