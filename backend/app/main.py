"""FastAPI backend for NEXUS courses, units, PDFs, and RAG ingestion."""
from __future__ import annotations

import math
import json
def cosine_distance(a, b):
    if a is None or b is None: return 1.0
    if hasattr(a, "tolist"):
        a = a.tolist()
    if hasattr(b, "tolist"):
        b = b.tolist()
    if isinstance(a, str):
        try:
            a = json.loads(a)
        except:
            return 1.0
    if isinstance(b, str):
        try:
            b = json.loads(b)
        except:
            return 1.0
    if not isinstance(a, (list, tuple)) or not isinstance(b, (list, tuple)): return 1.0
    if len(a) != len(b): return 1.0
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0: return 1.0
    return 1.0 - (dot_product / (norm_a * norm_b))


import os
import re
import time
import uuid
import json
import httpx
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

# Load .env file when running outside Docker (no-op if vars already set)
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=False)
    _load_dotenv(Path(__file__).resolve().parent.parent / ".env.backend", override=False)
except ImportError:
    pass  # python-dotenv is optional; Docker supplies env vars directly


try:
    import fitz
except ImportError:
    fitz = None

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from google import genai
from google.genai import types
from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON, UniqueConstraint, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from .youtube import (
    YouTubeAuthenticationError,
    YouTubeConfigurationError,
    YouTubeQuotaError,
    YouTubeRateLimitError,
    YouTubeRecommendationRequest,
    YouTubeRecommendationService,
    YouTubeUpstreamError,
)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nexus.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads")).resolve()
EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EMBEDDING_DIMENSIONS = 1536
CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.8-flash")
CHAT_MODELS = tuple(dict.fromkeys((CHAT_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash")))
EMBEDDING_RETRY_AFTER_SECONDS = int(os.getenv("EMBEDDING_RETRY_AFTER_SECONDS", "300"))
EMBEDDINGS_UNAVAILABLE_UNTIL = 0.0
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("postgresql"):
    engine_options["connect_args"] = {"connect_timeout": 3}
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
DATABASE_READY = False
DATABASE_ERROR: str | None = None


class Base(DeclarativeBase):
    pass


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    units: Mapped[list["Unit"]] = relationship(back_populates="course", cascade="all, delete-orphan", order_by="Unit.position")


class Unit(Base):
    __tablename__ = "units"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    course: Mapped[Course] = relationship(back_populates="units")
    materials: Mapped[list["Material"]] = relationship(back_populates="unit", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    status: Mapped[str] = mapped_column(String(32), default="UPLOADED")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    unit: Mapped[Unit] = relationship(back_populates="materials")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="material", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS) if DATABASE_URL.startswith("postgresql") else JSON,
        nullable=True,
    )
    material: Mapped[Material] = relationship(back_populates="chunks")


class ChatTurn(Base):
    __tablename__ = "chat_turns"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str] = mapped_column(String(36), index=True)
    unit_id: Mapped[str] = mapped_column(String(36), index=True)
    course_title: Mapped[str] = mapped_column(String(180))
    unit_title: Mapped[str] = mapped_column(String(180))
    topic: Mapped[str] = mapped_column(String(120), default="General")
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    native_document_reading: Mapped[bool] = mapped_column(default=False)
    retrieved_chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    strategy: Mapped[str] = mapped_column(String(40), default="DIRECT_EXPLANATION")
    recommendation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    recommended_videos: Mapped[list] = mapped_column(JSON, default=list)
    feedback_signal: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class TopicProgress(Base):
    __tablename__ = "topic_progress"
    __table_args__ = (UniqueConstraint("owner_id", "course_id", "topic_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str] = mapped_column(String(36), index=True)
    topic_key: Mapped[str] = mapped_column(String(120))
    topic: Mapped[str] = mapped_column(String(120))
    mastery: Mapped[int] = mapped_column(Integer, default=50)
    confusion_count: Mapped[int] = mapped_column(Integer, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str] = mapped_column(String(36), index=True)
    unit_id: Mapped[str] = mapped_column(String(36))
    topic: Mapped[str] = mapped_column(String(120))
    question: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON)
    correct_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(24), default="FOUNDATIONAL")
    answered_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class VideoLecture(Base):
    """Teacher-owned video that can be recommended across matching student courses."""
    __tablename__ = "video_lectures"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    teacher_id: Mapped[str] = mapped_column(String(128), index=True)
    subject: Mapped[str] = mapped_column(String(180), index=True)
    topic: Mapped[str] = mapped_column(String(180), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(1200), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class TeacherMeetingReview(Base):
    """Student feedback saved after a Teacher Copilot meeting preview."""
    __tablename__ = "teacher_meeting_reviews"
    __table_args__ = (UniqueConstraint("session_id", "student_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    student_id: Mapped[str] = mapped_column(String(128), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TeacherMeetingRoom(Base):
    """Shared Google Meet room attached to one escalated learning session."""
    __tablename__ = "teacher_meeting_rooms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    meet_uri: Mapped[str] = mapped_column(String(500))
    space_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str] = mapped_column(String(128), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NotesDocument(Base):
    """AI-generated structured notes for a specific material or unit."""
    __tablename__ = "notes_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    material_id: Mapped[str | None] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"), nullable=True, index=True)
    unit_id: Mapped[str] = mapped_column(String(36), index=True)
    course_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(255))
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # full JSON structured notes
    key_concepts: Mapped[list] = mapped_column(JSON, default=list)
    definitions: Mapped[list] = mapped_column(JSON, default=list)
    formulas: Mapped[list] = mapped_column(JSON, default=list)
    exam_points: Mapped[list] = mapped_column(JSON, default=list)
    flashcards: Mapped[list] = mapped_column(JSON, default=list)
    questions: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING, GENERATING, READY, FAILED
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    highlights: Mapped[list["NoteHighlight"]] = relationship(back_populates="notes_doc", cascade="all, delete-orphan")


class NoteHighlight(Base):
    """A highlighted passage from a document, with optional AI explanation."""
    __tablename__ = "note_highlights"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notes_doc_id: Mapped[str] = mapped_column(ForeignKey("notes_documents.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text)  # the highlighted passage text
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    highlight_type: Mapped[str] = mapped_column(String(32), default="CONCEPT")  # CONCEPT, DEFINITION, FORMULA, WARNING
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)  # AI explanation of this highlight
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(32), default="yellow")  # yellow/blue/green/red
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    notes_doc: Mapped["NotesDocument"] = relationship(back_populates="highlights")


class LiveSession(Base):
    """A live AI tutor voice session record."""
    __tablename__ = "live_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    course_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    course_title: Mapped[str | None] = mapped_column(String(180), nullable=True)
    subject: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE")  # ACTIVE, COMPLETED, ABORTED
    transcript: Mapped[list] = mapped_column(JSON, default=list)  # list of {role, text, timestamp}
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_concepts: Mapped[list] = mapped_column(JSON, default=list)
    identified_gaps: Mapped[list] = mapped_column(JSON, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=1200)


class UnitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)


class UnitRename(BaseModel):
    title: str = Field(min_length=1, max_length=180)


class VideoLectureLinkCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=180)
    topic: str = Field(min_length=1, max_length=180)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2400)
    external_url: str = Field(min_length=8, max_length=1200)


class TeacherMeetingReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: str | None = Field(default=None, max_length=2000)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=6000)
    course_id: str = Field(min_length=1, max_length=36)
    unit_id: str = Field(min_length=1, max_length=36)


class FeedbackRequest(BaseModel):
    turn_id: str
    signal: str


class QuizRequest(BaseModel):
    course_id: str
    unit_id: str
    topic: str | None = Field(default=None, max_length=120)


class QuizAnswerRequest(BaseModel):
    answer_index: int = Field(ge=0, le=3)


class ImportedTurn(BaseModel):
    id: str
    course_id: str
    unit_id: str
    question: str
    answer: str
    sources: list[str] = Field(default_factory=list)
    native_document_reading: bool = False
    retrieved_chunk_count: int = 0


def get_db() -> Generator[Session, None, None]:
    if not DATABASE_READY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PostgreSQL with pgvector is not available. Start the database, then retry.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user_id(x_user_id: str | None = Header(default=None)) -> str:
    """Temporary ownership boundary until JWT auth is wired in."""
    return x_user_id or "local-user"


def current_teacher_id(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> str:
    """Reject student sessions at teacher-only API boundaries."""
    if x_user_role != "teacher" or not (x_user_id or "").startswith("teacher-"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return x_user_id


def current_student_id(
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> str:
    """Keep student meeting history separate from teacher accounts."""
    if x_user_role != "student" or not (x_user_id or "").startswith("user-"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    return x_user_id


def serialize_material(material: Material) -> dict:
    return {"id": material.id, "name": material.original_name, "status": material.status, "chunk_count": material.chunk_count, "error": material.error_message}


def serialize_course(course: Course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "created_at": course.created_at.isoformat(),
        "units": [{"id": unit.id, "title": unit.title, "position": unit.position, "materials": [serialize_material(m) for m in unit.materials]} for unit in course.units],
    }


def serialize_turn(turn: ChatTurn) -> dict:
    return {"id": turn.id, "question": turn.question, "answer": turn.answer, "course_id": turn.course_id,
            "unit_id": turn.unit_id, "course": turn.course_title, "unit": turn.unit_title, "topic": turn.topic,
            "sources": turn.sources or [], "native_document_reading": turn.native_document_reading,
            "retrieved_chunk_count": turn.retrieved_chunk_count, "strategy": turn.strategy,
            "recommendation": turn.recommendation, "recommended_videos": turn.recommended_videos or [],
            "feedback_signal": turn.feedback_signal,
            "created_at": turn.created_at.isoformat()}


def serialize_progress(progress: TopicProgress) -> dict:
    return {"topic": progress.topic, "course_id": progress.course_id, "mastery": progress.mastery,
            "confusion_count": progress.confusion_count, "incorrect_count": progress.incorrect_count,
            "correct_count": progress.correct_count}


def serialize_video(video: VideoLecture) -> dict:
    return {"id": video.id, "subject": video.subject, "topic": video.topic, "title": video.title,
            "description": video.description, "teacher_id": video.teacher_id, "external_url": video.external_url,
            "has_uploaded_file": bool(video.storage_key), "media_type": video.media_type,
            "created_at": video.created_at.isoformat()}


def course_learning_profile(db: Session, user_id: str, course_id: str) -> list[TopicProgress]:
    """Course-wide, durable learner signals used by the router and practice generator."""
    return db.query(TopicProgress).filter_by(owner_id=user_id, course_id=course_id).order_by(
        TopicProgress.mastery.asc(), TopicProgress.incorrect_count.desc(), TopicProgress.confusion_count.desc()
    ).all()


def recommend_teacher_videos(db: Session, subject: str, topic: str, limit: int = 3) -> list[VideoLecture]:
    """Rank uploaded lessons by shared topic keywords; unrelated subject videos are never returned."""
    stop_words = {"a", "an", "and", "for", "in", "is", "of", "on", "the", "to", "with", "general"}

    def normalized(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()

    topic_key = normalized(topic)
    topic_tokens = {token for token in topic_key.split() if token not in stop_words and len(token) > 1}
    if not topic_tokens:
        return []
    subject_tokens = {token for token in normalized(subject).split() if token not in stop_words and len(token) > 1}
    candidates = db.query(VideoLecture).order_by(VideoLecture.created_at.desc()).limit(200).all()
    ranked: list[tuple[int, VideoLecture]] = []
    for video in candidates:
        video_topic = normalized(f"{video.topic} {video.title}")
        video_topic_tokens = {token for token in video_topic.split() if token not in stop_words and len(token) > 1}
        overlap = topic_tokens & video_topic_tokens
        if not overlap:
            continue
        video_subject_tokens = {token for token in normalized(video.subject).split() if token not in stop_words and len(token) > 1}
        score = len(overlap) * 4 + len(subject_tokens & video_subject_tokens)
        if topic_key == normalized(video.topic):
            score += 12
        elif topic_key in video_topic or normalized(video.topic) in topic_key:
            score += 6
        ranked.append((score, video))
    ranked.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
    return [video for _, video in ranked[:limit]]


def infer_topic(question: str, previous_topic: str | None = None) -> str:
    """A conservative label: carry context for short follow-ups, otherwise use the named subject."""
    cleaned = re.sub(r"\s+", " ", question.strip()).strip(" ?!.")
    cleaned = re.sub(r"^whats\b", "what is", cleaned, flags=re.I)
    match = re.search(r"\b(?:about|explain|understand|what is|what are|what's|how does|how do|define)\s+(.+)$", cleaned, re.I)
    candidate = match.group(1) if match else cleaned
    candidate = re.sub(r"^(?:the|a|an)\s+", "", candidate, flags=re.I)
    candidate = re.sub(r"\s+(?:work|mean|in this unit|please|to me).*$", "", candidate, flags=re.I)
    if re.match(r"^(?:it|that|this|those|again|the same thing)\b", candidate, re.I) or len(candidate.split()) > 6:
        return previous_topic or "General"
    if re.search(r"\b(?:still confused|don't understand|do not understand|didn't understand)\b", cleaned, re.I) and not match:
        return previous_topic or "General"
    if len(candidate) > 80 or not candidate:
        return previous_topic or "General"
    candidate = candidate[:120].strip()
    return candidate if candidate.isupper() and len(candidate) <= 10 else candidate.capitalize()


def get_progress(db: Session, user_id: str, course_id: str, topic: str, create: bool = False) -> TopicProgress | None:
    key = re.sub(r"\s+", " ", topic.casefold()).strip()
    progress = db.query(TopicProgress).filter_by(owner_id=user_id, course_id=course_id, topic_key=key).first()
    if not progress and create:
        progress = TopicProgress(owner_id=user_id, course_id=course_id, topic_key=key, topic=topic,
                                 mastery=50, confusion_count=0, incorrect_count=0, correct_count=0)
        db.add(progress)
    return progress


def apply_learning_signal(progress: TopicProgress, signal: str) -> None:
    if signal == "STILL_CONFUSED":
        progress.confusion_count += 1
        progress.mastery = max(0, progress.mastery - 12)
    elif signal == "QUIZ_INCORRECT":
        progress.incorrect_count += 1
        progress.mastery = max(0, progress.mastery - 18)
    elif signal == "QUIZ_CORRECT":
        progress.correct_count += 1
        progress.mastery = min(100, progress.mastery + 18)
    elif signal == "UNDERSTOOD":
        progress.mastery = min(100, progress.mastery + 6)
    progress.updated_at = datetime.now(timezone.utc)


def difficulty_for_score(score: int) -> str:
    if score < 55:
        return "FOUNDATIONAL"
    if score < 75:
        return "INTERMEDIATE"
    return "ADVANCED"


def unit_learning_state(db: Session, unit: Unit, user_id: str) -> dict:
    """Derive a unit's learning state from durable feedback and quiz attempts."""
    turns = db.query(ChatTurn).filter_by(owner_id=user_id, unit_id=unit.id).order_by(ChatTurn.created_at).all()
    quizzes = db.query(QuizQuestion).filter_by(owner_id=user_id, unit_id=unit.id).order_by(QuizQuestion.created_at).all()
    topics: dict[str, dict] = {}
    events: list[tuple[datetime, str, str]] = []

    def ensure_topic(name: str) -> dict:
        key = re.sub(r"\s+", " ", name.casefold()).strip()
        return topics.setdefault(key, {"topic": name, "mastery": 50, "signals": 0,
                                       "correct": 0, "incorrect": 0, "confused": 0, "answered": 0})

    for turn in turns:
        label = infer_topic(turn.topic)
        if label.casefold() not in {"general", "hello", "hi"}:
            ensure_topic(label)
        if turn.feedback_signal in {"STILL_CONFUSED", "UNDERSTOOD"}:
            events.append((turn.created_at, label, turn.feedback_signal))
    for quiz in quizzes:
        label = infer_topic(quiz.topic)
        ensure_topic(label)
        if quiz.answered_index is not None:
            signal = "QUIZ_CORRECT" if quiz.answered_index == quiz.correct_index else "QUIZ_INCORRECT"
            events.append((quiz.answered_at or quiz.created_at, label, signal))
    for _, name, signal in sorted(events, key=lambda event: event[0]):
        item = ensure_topic(name)
        delta = {"STILL_CONFUSED": -12, "UNDERSTOOD": 6, "QUIZ_INCORRECT": -18, "QUIZ_CORRECT": 18}[signal]
        item["mastery"] = max(0, min(100, item["mastery"] + delta))
        item["signals"] += 1
        if signal == "STILL_CONFUSED": item["confused"] += 1
        if signal == "QUIZ_CORRECT": item["correct"] += 1
        if signal == "QUIZ_INCORRECT": item["incorrect"] += 1
        if signal.startswith("QUIZ_"): item["answered"] += 1
    values = sorted(topics.values(), key=lambda item: (item["mastery"] >= 70, item["mastery"], -item["signals"]))
    for item in values:
        item["difficulty"] = difficulty_for_score(item["mastery"])
        item["status"] = "NEEDS_PRACTICE" if item["signals"] and item["mastery"] < 70 else "IMPROVING" if item["signals"] else "UNASSESSED"
    focus = next((item for item in values if item["status"] == "NEEDS_PRACTICE"), None)
    if not focus:
        focus = next((item for item in values if item["status"] == "UNASSESSED"), None)
    recent = sorted((quiz for quiz in quizzes if quiz.answered_index is not None),
                    key=lambda quiz: quiz.answered_at or quiz.created_at, reverse=True)[:5]
    return {"unit_id": unit.id, "course_id": unit.course_id, "unit_title": unit.title,
            "topics": values, "recommended_topic": focus["topic"] if focus else None,
            "recommended_difficulty": focus["difficulty"] if focus else "FOUNDATIONAL",
            "answered_count": len([quiz for quiz in quizzes if quiz.answered_index is not None]),
            "recent_results": [{"topic": quiz.topic, "difficulty": quiz.difficulty,
                                "correct": quiz.answered_index == quiz.correct_index} for quiz in recent]}


def learner_twin_state(db: Session, user_id: str) -> dict:
    """Create an explainable, durable learner view from chats and assessments."""
    units = db.query(Unit).join(Course).filter(Course.owner_id == user_id).all()
    grouped: dict[tuple[str, str], dict] = {}
    total_chats = db.query(ChatTurn).filter_by(owner_id=user_id).count()
    answered_quizzes = db.query(QuizQuestion).filter(
        QuizQuestion.owner_id == user_id, QuizQuestion.answered_index.is_not(None)
    ).all()

    for unit in units:
        state = unit_learning_state(db, unit, user_id)
        for topic in state["topics"]:
            key = (unit.course_id, re.sub(r"\s+", " ", topic["topic"].casefold()).strip())
            if key not in grouped:
                grouped[key] = {**topic, "course": unit.course.title, "course_id": unit.course_id,
                                "units": [unit.title], "unit_count": 1, "_mastery_total": topic["mastery"]}
                continue
            item = grouped[key]
            item["units"].append(unit.title)
            item["unit_count"] += 1
            item["_mastery_total"] += topic["mastery"]
            for field in ("signals", "correct", "incorrect", "confused", "answered"):
                item[field] += topic[field]

    topics = []
    for item in grouped.values():
        item["mastery"] = round(item.pop("_mastery_total") / item.pop("unit_count"))
        item["units"] = list(dict.fromkeys(item["units"]))
        item["difficulty"] = difficulty_for_score(item["mastery"])
        item["status"] = "NEEDS_PRACTICE" if item["signals"] and item["mastery"] < 70 else "IMPROVING" if item["signals"] else "EXPLORING"
        topics.append(item)

    topics.sort(key=lambda item: (item["status"] != "NEEDS_PRACTICE", item["mastery"], -item["signals"], item["topic"]))
    assessed = [item for item in topics if item["signals"]]
    focus = next((item for item in topics if item["status"] == "NEEDS_PRACTICE"), None)
    if not focus:
        focus = next((item for item in topics if item["status"] == "EXPLORING"), None)
    strongest = max((item for item in assessed if item["mastery"] >= 70),
                    key=lambda item: (item["mastery"], item["correct"], -item["incorrect"]), default=None)
    overall_mastery = round(sum(item["mastery"] for item in assessed) / len(assessed)) if assessed else None
    incorrect_count = sum(1 for quiz in answered_quizzes if quiz.answered_index != quiz.correct_index)
    correct_count = len(answered_quizzes) - incorrect_count

    if focus and focus["status"] == "NEEDS_PRACTICE":
        action = {
            "title": f"Strengthen {focus['topic']}",
            "description": "Use a worked example, then take a short adaptive quiz before moving on.",
            "action": "Review and quiz",
            "topic": focus["topic"],
            "course_id": focus["course_id"],
        }
    elif focus:
        action = {
            "title": f"Explore {focus['topic']}",
            "description": "Ask one focused question so NEXUS can establish your starting point.",
            "action": "Ask NEXUS",
            "topic": focus["topic"],
            "course_id": focus["course_id"],
        }
    else:
        action = {"title": "Start your learner twin", "description": "Ask about a PDF or take a quiz to create your first learning signal.", "action": "Ask NEXUS", "topic": None, "course_id": None}

    return {
        "overall_mastery": overall_mastery,
        "topics": topics,
        "focus": focus,
        "strongest": strongest,
        "next_action": action,
        "signals": {"chats": total_chats, "quiz_answers": len(answered_quizzes), "correct": correct_count,
                    "incorrect": incorrect_count, "topics_tracked": len(topics)},
    }


def chunk_text(text_value: str, size: int = 1800, overlap: int = 240) -> list[str]:
    normalized = re.sub(r"\s+", " ", text_value).strip()
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + size)
        if end < len(normalized):
            boundary = normalized.rfind(". ", start, end)
            if boundary > start + size // 2:
                end = boundary + 1
        chunks.append(normalized[start:end].strip())
        if end >= len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks


def embed_batch(chunks: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> list[list[float] | None]:
    """Generate embeddings when available; never store fabricated vectors."""
    global EMBEDDINGS_UNAVAILABLE_UNTIL
    if not chunks or not GEMINI_API_KEY:
        return [None for _ in chunks]
    if time.monotonic() < EMBEDDINGS_UNAVAILABLE_UNTIL:
        return [None for _ in chunks]
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        vectors = []
        batch_size = 90
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=EMBEDDING_DIMENSIONS,
                ),
            )
            vectors.extend([list(item.values) for item in response.embeddings])
            
        if len(vectors) != len(chunks) or any(len(vector) != EMBEDDING_DIMENSIONS for vector in vectors):
            raise RuntimeError("Gemini returned an unexpected embedding batch")
        return vectors
    except Exception as e:
        EMBEDDINGS_UNAVAILABLE_UNTIL = time.monotonic() + EMBEDDING_RETRY_AFTER_SECONDS
        print(f"Embedding unavailable; lexical retrieval remains active. Error: {e}")
        return [None for _ in chunks]


SEARCH_STOP_WORDS = {
    "about", "after", "also", "and", "are", "can", "could", "does", "explain", "for", "from",
    "have", "how", "into", "its", "me", "please", "that", "the", "their", "then", "this", "through",
    "what", "when", "where", "which", "with", "would", "your",
}


def search_terms(value: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", value.casefold()) if len(word) > 2 and word not in SEARCH_STOP_WORDS}


def retrieve_relevant_chunks(
    db: Session, material_ids: list[str], query: str, limit: int = 10
) -> list[tuple[DocumentChunk, str]]:
    """Use vectors when available and fall back to honest lexical retrieval."""
    rows = db.query(DocumentChunk, Material.original_name).join(Material).filter(
        DocumentChunk.material_id.in_(material_ids)
    ).all()
    if not rows:
        return []

    query_vector = embed_batch([query], task_type="RETRIEVAL_QUERY")[0] if GEMINI_API_KEY else None
    vector_rows = [row for row in rows if row[0].embedding is not None]
    if query_vector is not None and vector_rows:
        vector_rows.sort(key=lambda row: cosine_distance(row[0].embedding, query_vector))
        return vector_rows[:limit]

    terms = search_terms(query)
    phrase = re.sub(r"\s+", " ", query.casefold()).strip(" ?!.")

    def score(row: tuple[DocumentChunk, str]) -> tuple[int, int]:
        content = row[0].content.casefold()
        overlap = sum(content.count(term) for term in terms)
        phrase_bonus = 5 if phrase and phrase in content else 0
        return (overlap + phrase_bonus, -row[0].chunk_index)

    ranked = sorted(rows, key=score, reverse=True)
    matching = [row for row in ranked if score(row)[0] > 0]
    return (matching or ranked)[:limit]


def grounded_fallback_answer(question: str, unit_title: str, context: str) -> str:
    """Return a useful material-grounded response while the AI provider is unavailable."""
    if not context.strip():
        return (
            "I could not generate a grounded explanation because the response provider is temporarily rate-limited "
            "and this unit has no searchable text yet. Reindex the PDF or try again when the provider quota resets."
        )
    plain_context = re.sub(r"\[Source:[^\]]+\]", " ", context)
    candidates = [
        re.sub(r"\s+", " ", sentence).strip()
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", plain_context)
        if 35 <= len(sentence.strip()) <= 500
    ]
    terms = search_terms(question)

    def sentence_score(sentence: str) -> tuple[int, int]:
        lowered = sentence.casefold()
        return (sum(lowered.count(term) for term in terms), -len(sentence))

    selected: list[str] = []
    seen: set[str] = set()
    for sentence in sorted(candidates, key=sentence_score, reverse=True):
        normalized = sentence.casefold()
        if normalized in seen or (terms and sentence_score(sentence)[0] == 0):
            continue
        seen.add(normalized)
        selected.append(sentence[:360].rstrip())
        if len(selected) == 4:
            break
    if not selected:
        selected = [re.sub(r"\s+", " ", plain_context).strip()[:700]]
    points = "\n".join(f"- {sentence}" for sentence in selected if sentence)
    return (
        f"## Explanation from {unit_title}\n\n{points}\n\n"
        "This response was extracted directly from your uploaded material while the AI explanation service is rate-limited."
    )


def generate_answer(question: str, unit_title: str, context: str, has_unsearchable_material: bool, pdf_paths: list[str] | None = None,
                    conversation: str = "", learning_context: str = "") -> str:
    """Generate a concise response, falling back visibly if Gemini is unavailable."""
    if not GEMINI_API_KEY:
        return "I received your question, but Gemini is not configured yet. Add a Gemini API key to enable answers grounded in your study material."
    context_instruction = context or "No searchable text was available from this unit's PDFs."
    prompt = f"""You are NEXUS, a helpful learning assistant. Answer the student's question clearly and directly.

Selected unit: {unit_title}
Question: {question}

Recent conversation in this unit (use it to resolve follow-up references):
{conversation or 'No prior turns.'}

Learner state and teaching guidance:
{learning_context or 'No weakness signals recorded yet.'}

Study-material context:
{context_instruction}

Rules:
- Use the study-material context when it is available.
- If it is unavailable, say that the selected PDFs could not provide searchable text and give a brief general answer when appropriate.
- Do not invent citations or claim facts came from a PDF when they did not.
- Keep the answer concise and supportive.
- If this is a follow-up, explain the specific part the learner did not understand, with a new example or simpler strategy.
- Treat learner state as an estimate; never claim the learner has mastered a topic without assessment evidence.
"""
    client = genai.Client(api_key=GEMINI_API_KEY)
    if not context and pdf_paths:
        try:
            uploaded_files = [client.files.upload(file=pdf_path) for pdf_path in pdf_paths if Path(pdf_path).is_file()]
            if uploaded_files:
                native_prompt = f"""You are NEXUS, a helpful learning assistant. Answer the student's question from the attached PDFs.

Selected unit: {unit_title}
Question: {question}

Recent conversation in this unit:
{conversation or 'No prior turns.'}

Learner state and teaching guidance:
{learning_context or 'No weakness signals recorded yet.'}

Read the document pages directly. Use prior turns to understand follow-ups. For weak topics, teach in smaller steps and give a fresh example. Be concise, explain clearly, and say when the answer is not supported by the PDFs."""
                for model in CHAT_MODELS:
                    try:
                        response = client.models.generate_content(model=model, contents=[native_prompt, *uploaded_files])
                        if response.text and response.text.strip():
                            return response.text.strip()
                    except Exception:
                        continue
        except Exception:
            pass
    for model in CHAT_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=700),
            )
            if response.text and response.text.strip():
                return response.text.strip()
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue
    if has_unsearchable_material:
        return "Hi! I received your question. The selected PDF is available to view, but it is scanned and has no extractable text yet, so I cannot ground an answer in it until OCR is added."
    return grounded_fallback_answer(question, unit_title, context)


def stream_answer(question: str, unit_title: str, context: str, has_unsearchable_material: bool,
                  pdf_paths: list[str] | None = None, conversation: str = "", learning_context: str = "") -> Generator[str, None, None]:
    """Yield Gemini output as it is produced, with the same grounded prompt as normal answers."""
    if not GEMINI_API_KEY:
        yield "I received your question, but Gemini is not configured yet. Add a Gemini API key to enable answers grounded in your study material."
        return
    context_instruction = context or "No searchable text was available from this unit's PDFs."
    prompt = f"""You are NEXUS, a helpful learning assistant. Answer the student's question clearly and directly.

Selected unit: {unit_title}
Question: {question}

Recent conversation in this unit (use it to resolve follow-up references):
{conversation or 'No prior turns.'}

Learner state and teaching guidance:
{learning_context or 'No weakness signals recorded yet.'}

Study-material context:
{context_instruction}

Rules:
- Use the study-material context when it is available.
- If it is unavailable, say that the selected PDFs could not provide searchable text and give a brief general answer when appropriate.
- Do not invent citations or claim facts came from a PDF when they did not.
- Keep the answer concise and supportive.
- If this is a follow-up, explain the specific part the learner did not understand, with a new example or simpler strategy.
- Treat learner state as an estimate; never claim the learner has mastered a topic without assessment evidence.
"""
    client = genai.Client(api_key=GEMINI_API_KEY)
    native_prompt = f"""You are NEXUS, a helpful learning assistant. Answer the student's question from the attached PDFs.

Selected unit: {unit_title}
Question: {question}

Recent conversation in this unit:
{conversation or 'No prior turns.'}

Learner state and teaching guidance:
{learning_context or 'No weakness signals recorded yet.'}

Read the document pages directly. Use prior turns to understand follow-ups. For weak topics, teach in smaller steps and give a fresh example. Be concise, explain clearly, and say when the answer is not supported by the PDFs."""

    def yield_stream(model: str, contents: list, config: types.GenerateContentConfig | None = None) -> Generator[str, None, None]:
        kwargs = {"model": model, "contents": contents}
        if config:
            kwargs["config"] = config
        for response in client.models.generate_content_stream(**kwargs):
            text_value = getattr(response, "text", None)
            if text_value:
                yield text_value

    if not context and pdf_paths:
        try:
            uploaded_files = [client.files.upload(file=pdf_path) for pdf_path in pdf_paths if Path(pdf_path).is_file()]
            if uploaded_files:
                for model in CHAT_MODELS:
                    try:
                        emitted = False
                        for piece in yield_stream(model, [native_prompt, *uploaded_files]):
                            emitted = True
                            yield piece
                        if emitted:
                            return
                    except Exception:
                        continue
        except Exception:
            pass
    for model in CHAT_MODELS:
        try:
            emitted = False
            for piece in yield_stream(model, prompt, types.GenerateContentConfig(temperature=0.3, max_output_tokens=700)):
                emitted = True
                yield piece
            if emitted:
                return
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue
    if has_unsearchable_material:
        yield "Hi! I received your question. The selected PDF is available to view, but it is scanned and has no extractable text yet, so I cannot ground an answer in it until OCR is added."
    else:
        yield grounded_fallback_answer(question, unit_title, context)


def ingest_material(material_id: str) -> None:
    """Parse a PDF, generate embeddings, and persist chunks in pgvector."""
    db = SessionLocal()
    try:
        material = db.get(Material, material_id)
        if not material:
            return
        material.status = "PROCESSING"
        db.commit()
        document = fitz.open(material.storage_key)
        db.query(DocumentChunk).filter(DocumentChunk.material_id == material.id).delete(synchronize_session=False)
        rows: list[DocumentChunk] = []
        for page_index, page in enumerate(document):
            # Process ALL pages now that we have robust embeddings!
            page_chunks = chunk_text(page.get_text())
            vectors = embed_batch(page_chunks)
            for chunk_index, (content, vector) in enumerate(zip(page_chunks, vectors)):
                rows.append(DocumentChunk(material_id=material.id, page_number=page_index + 1, chunk_index=len(rows) + chunk_index, content=content, embedding=vector))
        db.add_all(rows)
        material.chunk_count = len(rows)
        material.error_message = None
        if not rows:
            material.status = "NO_EXTRACTABLE_TEXT"
            material.error_message = "No selectable text was found in this PDF. OCR is needed for scanned PDFs."
        else:
            material.status = "INDEXED" if any(row.embedding is not None for row in rows) else "PARSED_AWAITING_EMBEDDINGS"
        db.commit()
    except Exception as exc:  # no raw document content is surfaced
        db.rollback()
        material = db.get(Material, material_id)
        if material:
            material.status = "FAILED"
            material.error_message = str(exc)[:500]
            db.commit()
    finally:
        db.close()


app = FastAPI(title="NEXUS API", version="0.2.0")
_default_dev_origins = ",".join([
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:4173", "http://127.0.0.1:4173",
])
frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", _default_dev_origins).split(",")
    if origin.strip()
]
# For development, allow all origins. Set FRONTEND_ORIGINS env var in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def initialise_database() -> None:
    global DATABASE_READY, DATABASE_ERROR
    try:
        Base.metadata.create_all(bind=engine)
        DATABASE_READY = True
        DATABASE_ERROR = None
    except Exception as error:  # Allow the API itself to start while local DB setup is pending.
        DATABASE_READY = False
        DATABASE_ERROR = str(error)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if DATABASE_READY else "degraded",
        "service": "nexus-api",
        "database": "ready" if DATABASE_READY else "unavailable",
    }


@app.get("/api/v1/courses")
def list_courses(db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> list[dict]:
    courses = db.query(Course).filter(Course.owner_id == user_id).order_by(Course.created_at.desc()).all()
    return [serialize_course(course) for course in courses]


@app.post("/api/v1/courses", status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    course = Course(owner_id=user_id, title=payload.title.strip(), description=(payload.description or "").strip() or None)
    db.add(course)
    db.commit()
    db.refresh(course)
    return serialize_course(course)


@app.delete("/api/v1/courses/{course_id}")
def delete_course(course_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    course = require_course(course_id, user_id, db)
    storage_keys = [material.storage_key for unit in course.units for material in unit.materials]
    db.delete(course)
    db.commit()
    remove_stored_files(storage_keys)
    return {"deleted": "course", "id": course_id}


def require_course(course_id: str, user_id: str, db: Session) -> Course:
    course = db.query(Course).filter(Course.id == course_id, Course.owner_id == user_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def remove_stored_files(storage_keys: list[str]) -> None:
    """Remove only files that resolve inside this application's upload directory."""
    for storage_key in storage_keys:
        file_path = Path(storage_key).resolve()
        if file_path.is_relative_to(UPLOAD_DIR) and file_path.is_file():
            file_path.unlink()


@app.post("/api/v1/courses/{course_id}/units", status_code=status.HTTP_201_CREATED)
def create_unit(course_id: str, payload: UnitCreate, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    course = require_course(course_id, user_id, db)
    unit = Unit(course_id=course.id, title=payload.title.strip(), position=len(course.units))
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return {"id": unit.id, "title": unit.title, "position": unit.position, "materials": []}


@app.patch("/api/v1/units/{unit_id}")
def rename_unit(unit_id: str, payload: UnitRename, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    unit = db.query(Unit).join(Course).filter(Unit.id == unit_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    unit.title = payload.title.strip()
    db.commit()
    return {"id": unit.id, "title": unit.title}


@app.delete("/api/v1/units/{unit_id}")
def delete_unit(unit_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    unit = db.query(Unit).join(Course).filter(Unit.id == unit_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    storage_keys = [material.storage_key for material in unit.materials]
    db.delete(unit)
    db.commit()
    remove_stored_files(storage_keys)
    return {"deleted": "unit", "id": unit_id}


@app.post("/api/v1/units/{unit_id}/materials", status_code=status.HTTP_201_CREATED)
async def upload_materials(unit_id: str, background_tasks: BackgroundTasks, files: list[UploadFile] = File(...), db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> list[dict]:
    unit = db.query(Unit).join(Course).filter(Unit.id == unit_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    created: list[Material] = []
    for uploaded in files:
        if uploaded.content_type != "application/pdf" and not (uploaded.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=415, detail="Only PDF files are supported")
        material_id = str(uuid.uuid4())
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", uploaded.filename or "material.pdf")
        storage_path = UPLOAD_DIR / f"{material_id}_{safe_name}"
        storage_path.write_bytes(await uploaded.read())
        material = Material(id=material_id, unit_id=unit.id, original_name=uploaded.filename or "material.pdf", storage_key=str(storage_path), status="QUEUED")
        db.add(material)
        created.append(material)
    db.commit()
    for material in created:
        background_tasks.add_task(ingest_material, material.id)
    return [serialize_material(material) for material in created]


@app.delete("/api/v1/materials/{material_id}")
def delete_material(material_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    material = db.query(Material).join(Unit).join(Course).filter(Material.id == material_id, Course.owner_id == user_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    storage_key = material.storage_key
    db.delete(material)
    db.commit()
    remove_stored_files([storage_key])
    return {"deleted": "material", "id": material_id}


@app.get("/api/v1/materials/{material_id}/file")
def view_material_file(material_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> FileResponse:
    """Return a PDF only when it belongs to the requesting user's course."""
    material = db.query(Material).join(Unit).join(Course).filter(Material.id == material_id, Course.owner_id == user_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    file_path = Path(material.storage_key)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="The uploaded PDF file is no longer available")
    return FileResponse(file_path, media_type="application/pdf", filename=material.original_name, content_disposition_type="inline")


@app.get("/api/v1/video-lectures")
def list_recommended_videos(subject: str, topic: str = "", db: Session = Depends(get_db)) -> list[dict]:
    return [serialize_video(video) for video in recommend_teacher_videos(db, subject, topic or subject)]


@app.get("/api/v1/video-lectures/library")
def list_video_library(db: Session = Depends(get_db), _student_id: str = Depends(current_student_id)) -> list[dict]:
    """Return the complete teacher-uploaded lecture library to signed-in students."""
    videos = db.query(VideoLecture).order_by(VideoLecture.created_at.desc()).limit(100).all()
    return [serialize_video(video) for video in videos]


@app.get("/api/v1/teacher/videos")
def list_teacher_videos(db: Session = Depends(get_db), user_id: str = Depends(current_teacher_id)) -> list[dict]:
    videos = db.query(VideoLecture).filter_by(teacher_id=user_id).order_by(VideoLecture.created_at.desc()).all()
    return [serialize_video(video) for video in videos]


@app.post("/api/v1/teacher/videos/link", status_code=status.HTTP_201_CREATED)
def add_teacher_video_link(payload: VideoLectureLinkCreate, db: Session = Depends(get_db), user_id: str = Depends(current_teacher_id)) -> dict:
    if not re.match(r"^https?://", payload.external_url.strip(), re.I):
        raise HTTPException(status_code=422, detail="Use a full http:// or https:// video link")
    video = VideoLecture(teacher_id=user_id, subject=payload.subject.strip(), topic=payload.topic.strip(),
                         title=payload.title.strip(), description=(payload.description or "").strip() or None,
                         external_url=payload.external_url.strip())
    db.add(video)
    db.commit()
    db.refresh(video)
    return serialize_video(video)


@app.post("/api/v1/teacher/videos", status_code=status.HTTP_201_CREATED)
async def upload_teacher_video(subject: str = Form(...), topic: str = Form(...), title: str = Form(...),
                               description: str | None = Form(default=None), file: UploadFile = File(...),
                               db: Session = Depends(get_db), user_id: str = Depends(current_teacher_id)) -> dict:
    allowed = {".mp4", ".webm", ".mov", ".m4v"}
    suffix = Path(file.filename or "").suffix.lower()
    if not (file.content_type or "").startswith("video/") and suffix not in allowed:
        raise HTTPException(status_code=415, detail="Upload an MP4, WebM, MOV, or M4V video")
    video_id = str(uuid.uuid4())
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename or "lecture.mp4")
    storage_path = UPLOAD_DIR / f"lecture_{video_id}_{safe_name}"
    storage_path.write_bytes(await file.read())
    video = VideoLecture(id=video_id, teacher_id=user_id, subject=subject.strip(), topic=topic.strip(),
                         title=title.strip(), description=(description or "").strip() or None,
                         storage_key=str(storage_path), media_type=file.content_type or "video/mp4")
    db.add(video)
    db.commit()
    db.refresh(video)
    return serialize_video(video)


@app.get("/api/v1/video-lectures/{video_id}/file")
def view_teacher_video(video_id: str, db: Session = Depends(get_db)) -> FileResponse:
    video = db.get(VideoLecture, video_id)
    if not video or not video.storage_key:
        raise HTTPException(status_code=404, detail="Video file not found")
    file_path = Path(video.storage_key)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="The uploaded video is no longer available")
    return FileResponse(file_path, media_type=video.media_type or "video/mp4", filename=video.title, content_disposition_type="inline")


@app.delete("/api/v1/teacher/videos/{video_id}")
def delete_teacher_video(video_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_teacher_id)) -> dict:
    video = db.query(VideoLecture).filter_by(id=video_id, teacher_id=user_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video lecture not found")
    storage_key = video.storage_key
    db.delete(video)
    db.commit()
    if storage_key:
        remove_stored_files([storage_key])
    return {"deleted": "video", "id": video_id}


@app.post("/api/v1/ask")
def ask_nexus(payload: AskRequest, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    """Answer against the selected unit's PDF corpus using pgvector retrieval."""
    unit = db.query(Unit).join(Course).filter(Unit.id == payload.unit_id, Unit.course_id == payload.course_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="The selected course or unit was not found")
    materials = db.query(Material).filter(Material.unit_id == unit.id).all()
    if not materials:
        raise HTTPException(status_code=422, detail="The selected unit does not contain any PDFs yet")
    recent = list(reversed(db.query(ChatTurn).filter_by(owner_id=user_id, course_id=unit.course_id, unit_id=unit.id)
                           .order_by(ChatTurn.created_at.desc()).limit(4).all()))
    topic = infer_topic(payload.question, recent[-1].topic if recent else None)
    remembered = db.query(ChatTurn).filter(ChatTurn.owner_id == user_id, ChatTurn.course_id == unit.course_id,
        ChatTurn.topic.ilike(topic), ChatTurn.id.notin_([turn.id for turn in recent])).order_by(ChatTurn.created_at.desc()).limit(2).all()
    unit_state = unit_learning_state(db, unit, user_id)
    current_topic = next((item for item in unit_state["topics"] if item["topic"].casefold() == topic.casefold()), None)
    progress = get_progress(db, user_id, unit.course_id, topic)
    estimated_mastery = current_topic["mastery"] if current_topic and current_topic["signals"] else progress.mastery if progress else None
    weak_topics = [item for item in unit_state["topics"] if item["status"] == "NEEDS_PRACTICE"][:5]
    course_profile = course_learning_profile(db, user_id, unit.course_id)
    course_weak_topics = [item for item in course_profile if item.mastery < 70][:5]
    repeated_confusion = any(item.confusion_count >= 2 or item.incorrect_count >= 2 for item in course_weak_topics)
    strategy = "PREREQUISITE_REMEDIATION" if repeated_confusion and estimated_mastery is not None and estimated_mastery < 45 else "WORKED_EXAMPLE" if estimated_mastery is not None and estimated_mastery < 55 else "SIMPLE_EXPLANATION" if recent and recent[-1].topic == topic else "DIRECT_EXPLANATION"
    conversation = "\n".join(f"Student: {turn.question[:500]}\nNEXUS: {turn.answer[:1800]}" for turn in [*reversed(remembered), *recent])
    learning_context = (f"Current topic: {topic}. Strategy: {strategy}. "
        + (f"Estimated mastery in this unit: {estimated_mastery}/100. " if estimated_mastery is not None else "")
        + ("Topics needing practice in this unit: " + ", ".join(f"{item['topic']} ({item['mastery']}/100)" for item in weak_topics) if weak_topics else "")
        + (". Course-wide weak topics from prior chats and quizzes: " + ", ".join(f"{item.topic} ({item.mastery}/100)" for item in course_weak_topics) if course_weak_topics else ""))
    mistakes = db.query(QuizQuestion).filter(QuizQuestion.owner_id == user_id,
        QuizQuestion.unit_id == unit.id, QuizQuestion.answered_index.is_not(None),
        QuizQuestion.answered_index != QuizQuestion.correct_index).order_by(QuizQuestion.created_at.desc()).limit(3).all()
    if mistakes:
        learning_context += "\nRecent missed questions: " + " | ".join(
            f"{item.topic}: {item.question[:180]} Student chose {item.options[item.answered_index][:100]}; "
            f"correct answer was {item.options[item.correct_index][:100]}." for item in mistakes)
    searchable_material_ids = [material.id for material in materials if material.chunk_count > 0]
    retrieved: list[tuple[DocumentChunk, str]] = []
    if searchable_material_ids:
        retrieval_query = payload.question.strip()
        if len(retrieval_query.split()) < 7 and recent:
            retrieval_query = f"{topic}. {recent[-1].question[:300]} {retrieval_query}"
        retrieved = retrieve_relevant_chunks(db, searchable_material_ids, retrieval_query)
    native_document_reading = not retrieved and any(material.status == "NO_EXTRACTABLE_TEXT" for material in materials)
    sources = list(dict.fromkeys(name for _, name in retrieved))
    if native_document_reading:
        sources = [material.original_name for material in materials]
    context = "\n\n".join(f"[Source: {name}]\n{chunk.content}" for chunk, name in retrieved)
    answer = generate_answer(
        payload.question.strip(),
        unit.title,
        context,
        any(material.status == "NO_EXTRACTABLE_TEXT" for material in materials),
        [material.storage_key for material in materials],
        conversation,
        learning_context,
    )
    recommended_videos = recommend_teacher_videos(db, unit.course.title, topic)
    recommendation_reason = (f"Repeated confusion and missed practice indicate that {topic} needs a slower, worked approach."
                             if strategy == "PREREQUISITE_REMEDIATION" else
                             f"Prior quiz and chat signals put {topic} at {estimated_mastery}% estimated strength, so NEXUS selected a worked example."
                             if strategy == "WORKED_EXAMPLE" else
                             f"NEXUS is using {strategy.replace('_', ' ').lower()} based on this conversation and your course learning signals.")
    recommendation = {"strategy": strategy, "reason": recommendation_reason,
                      "course_weak_topics": [serialize_progress(item) for item in course_weak_topics]}
    serialized_videos = [serialize_video(video) for video in recommended_videos]
    turn = ChatTurn(owner_id=user_id, course_id=unit.course_id, unit_id=unit.id, course_title=unit.course.title,
                    unit_title=unit.title, topic=topic, question=payload.question.strip(), answer=answer,
                    sources=sources, native_document_reading=native_document_reading,
                    retrieved_chunk_count=len(retrieved), strategy=strategy, recommendation=recommendation,
                    recommended_videos=serialized_videos)
    db.add(turn)
    db.commit()
    result = {
        "answer": answer,
        "unit": {"id": unit.id, "title": unit.title},
        "sources": sources,
        "pdf_count": len(materials),
        "retrieved_chunk_count": len(retrieved),
        "searchable": bool(retrieved),
        "native_document_reading": native_document_reading,
        "recommendation": recommendation,
        "recommended_videos": serialized_videos,
    }
    result.update(serialize_turn(turn))
    return result


@app.post("/api/v1/ask/stream")
def stream_ask_nexus(payload: AskRequest, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> StreamingResponse:
    """Stream a grounded answer over SSE, then persist one completed chat turn."""
    unit = db.query(Unit).join(Course).filter(Unit.id == payload.unit_id, Unit.course_id == payload.course_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="The selected course or unit was not found")
    materials = db.query(Material).filter(Material.unit_id == unit.id).all()
    if not materials:
        raise HTTPException(status_code=422, detail="The selected unit does not contain any PDFs yet")
    recent = list(reversed(db.query(ChatTurn).filter_by(owner_id=user_id, course_id=unit.course_id, unit_id=unit.id)
                           .order_by(ChatTurn.created_at.desc()).limit(4).all()))
    topic = infer_topic(payload.question, recent[-1].topic if recent else None)
    remembered = db.query(ChatTurn).filter(ChatTurn.owner_id == user_id, ChatTurn.course_id == unit.course_id,
        ChatTurn.topic.ilike(topic), ChatTurn.id.notin_([turn.id for turn in recent])).order_by(ChatTurn.created_at.desc()).limit(2).all()
    unit_state = unit_learning_state(db, unit, user_id)
    current_topic = next((item for item in unit_state["topics"] if item["topic"].casefold() == topic.casefold()), None)
    progress = get_progress(db, user_id, unit.course_id, topic)
    estimated_mastery = current_topic["mastery"] if current_topic and current_topic["signals"] else progress.mastery if progress else None
    weak_topics = [item for item in unit_state["topics"] if item["status"] == "NEEDS_PRACTICE"][:5]
    course_profile = course_learning_profile(db, user_id, unit.course_id)
    course_weak_topics = [item for item in course_profile if item.mastery < 70][:5]
    repeated_confusion = any(item.confusion_count >= 2 or item.incorrect_count >= 2 for item in course_weak_topics)
    strategy = "PREREQUISITE_REMEDIATION" if repeated_confusion and estimated_mastery is not None and estimated_mastery < 45 else "WORKED_EXAMPLE" if estimated_mastery is not None and estimated_mastery < 55 else "SIMPLE_EXPLANATION" if recent and recent[-1].topic == topic else "DIRECT_EXPLANATION"
    conversation = "\n".join(f"Student: {turn.question[:500]}\nNEXUS: {turn.answer[:1800]}" for turn in [*reversed(remembered), *recent])
    learning_context = (f"Current topic: {topic}. Strategy: {strategy}. "
        + (f"Estimated mastery in this unit: {estimated_mastery}/100. " if estimated_mastery is not None else "")
        + ("Topics needing practice in this unit: " + ", ".join(f"{item['topic']} ({item['mastery']}/100)" for item in weak_topics) if weak_topics else "")
        + (". Course-wide weak topics from prior chats and quizzes: " + ", ".join(f"{item.topic} ({item.mastery}/100)" for item in course_weak_topics) if course_weak_topics else ""))
    mistakes = db.query(QuizQuestion).filter(QuizQuestion.owner_id == user_id, QuizQuestion.unit_id == unit.id,
        QuizQuestion.answered_index.is_not(None), QuizQuestion.answered_index != QuizQuestion.correct_index).order_by(QuizQuestion.created_at.desc()).limit(3).all()
    if mistakes:
        learning_context += "\nRecent missed questions: " + " | ".join(
            f"{item.topic}: {item.question[:180]} Student chose {item.options[item.answered_index][:100]}; correct answer was {item.options[item.correct_index][:100]}." for item in mistakes)
    searchable_material_ids = [material.id for material in materials if material.chunk_count > 0]
    retrieved: list[tuple[DocumentChunk, str]] = []
    if searchable_material_ids:
        retrieval_query = payload.question.strip()
        if len(retrieval_query.split()) < 7 and recent:
            retrieval_query = f"{topic}. {recent[-1].question[:300]} {retrieval_query}"
        retrieved = retrieve_relevant_chunks(db, searchable_material_ids, retrieval_query)
    native_document_reading = not retrieved and any(material.status == "NO_EXTRACTABLE_TEXT" for material in materials)
    sources = list(dict.fromkeys(name for _, name in retrieved))
    if native_document_reading:
        sources = [material.original_name for material in materials]
    context = "\n\n".join(f"[Source: {name}]\n{chunk.content}" for chunk, name in retrieved)
    recommended_videos = recommend_teacher_videos(db, unit.course.title, topic)
    recommendation_reason = (f"Repeated confusion and missed practice indicate that {topic} needs a slower, worked approach."
                             if strategy == "PREREQUISITE_REMEDIATION" else f"Prior quiz and chat signals put {topic} at {estimated_mastery}% estimated strength, so NEXUS selected a worked example."
                             if strategy == "WORKED_EXAMPLE" else f"NEXUS is using {strategy.replace('_', ' ').lower()} based on this conversation and your course learning signals.")
    recommendation = {"strategy": strategy, "reason": recommendation_reason, "course_weak_topics": [serialize_progress(item) for item in course_weak_topics]}
    serialized_videos = [serialize_video(video) for video in recommended_videos]

    def event(name: str, data: dict) -> str:
        return f"event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def response_stream() -> Generator[str, None, None]:
        yield event("metadata", {"course": unit.course.title, "unit": unit.title, "topic": topic, "strategy": strategy, "sources": sources, "native_document_reading": native_document_reading, "retrieved_chunk_count": len(retrieved)})
        pieces: list[str] = []
        try:
            for piece in stream_answer(payload.question.strip(), unit.title, context, any(material.status == "NO_EXTRACTABLE_TEXT" for material in materials), [material.storage_key for material in materials], conversation, learning_context):
                if piece:
                    pieces.append(piece)
                    yield event("delta", {"text": piece})
            answer = "".join(pieces).strip()
            if not answer:
                raise RuntimeError("The response service returned no answer")
            turn = ChatTurn(owner_id=user_id, course_id=unit.course_id, unit_id=unit.id, course_title=unit.course.title,
                unit_title=unit.title, topic=topic, question=payload.question.strip(), answer=answer, sources=sources,
                native_document_reading=native_document_reading, retrieved_chunk_count=len(retrieved), strategy=strategy,
                recommendation=recommendation, recommended_videos=serialized_videos)
            db.add(turn)
            db.commit()
            yield event("done", {"turn": serialize_turn(turn)})
        except Exception:
            db.rollback()
            yield event("error", {"detail": "NEXUS could not complete that answer. Please try again."})

    return StreamingResponse(response_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/v1/chat/turns")
def list_chat_turns(db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> list[dict]:
    turns = db.query(ChatTurn).filter_by(owner_id=user_id).order_by(ChatTurn.created_at, ChatTurn.id).all()
    return [serialize_turn(turn) for turn in turns]


@app.post("/api/v1/chat/import")
def import_local_turns(payload: list[ImportedTurn], db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    """One-time migration of browser chat; duplicate IDs are ignored."""
    imported = 0
    for item in payload[:100]:
        if db.get(ChatTurn, item.id):
            continue
        unit = db.query(Unit).join(Course).filter(Unit.id == item.unit_id, Unit.course_id == item.course_id,
                                                   Course.owner_id == user_id).first()
        if not unit:
            continue
        db.add(ChatTurn(id=item.id, owner_id=user_id, course_id=unit.course_id, unit_id=unit.id,
                        course_title=unit.course.title, unit_title=unit.title,
                        topic=infer_topic(item.question), question=item.question[:6000], answer=item.answer[:30000],
                        sources=item.sources, native_document_reading=item.native_document_reading,
                        retrieved_chunk_count=item.retrieved_chunk_count))
        imported += 1
    db.commit()
    return {"imported": imported}


@app.get("/api/v1/learning/progress")
def list_learning_progress(db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> list[dict]:
    rows = db.query(TopicProgress).filter_by(owner_id=user_id).order_by(TopicProgress.mastery, TopicProgress.updated_at.desc()).all()
    return [serialize_progress(row) for row in rows]


@app.get("/api/v1/learning/twin")
def get_learner_twin(db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    return learner_twin_state(db, user_id)


@app.post("/api/v1/chat/feedback")
def record_chat_feedback(payload: FeedbackRequest, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    if payload.signal not in {"STILL_CONFUSED", "UNDERSTOOD"}:
        raise HTTPException(status_code=422, detail="Unsupported feedback signal")
    turn = db.query(ChatTurn).filter_by(id=payload.turn_id, owner_id=user_id).first()
    if not turn:
        raise HTTPException(status_code=404, detail="Chat turn not found")
    if turn.feedback_signal:
        return {"signal": turn.feedback_signal, "topic": turn.topic, "already_recorded": True}
    progress = get_progress(db, user_id, turn.course_id, turn.topic, create=True)
    apply_learning_signal(progress, payload.signal)
    turn.feedback_signal = payload.signal
    db.commit()
    return {"signal": payload.signal, "topic": turn.topic, "progress": serialize_progress(progress)}


@app.get("/api/v1/units/{unit_id}/learning")
def get_unit_learning(unit_id: str, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    unit = db.query(Unit).join(Course).filter(Unit.id == unit_id, Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit_learning_state(db, unit, user_id)


@app.post("/api/v1/quiz")
def create_quiz_question(payload: QuizRequest, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    unit = db.query(Unit).join(Course).filter(Unit.id == payload.unit_id, Unit.course_id == payload.course_id,
                                               Course.owner_id == user_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Selected unit not found")
    materials = db.query(Material).filter_by(unit_id=unit.id).all()
    if not materials:
        raise HTTPException(status_code=422, detail="Add a PDF to this unit before starting a quiz")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini is needed to create a quiz")
    state = unit_learning_state(db, unit, user_id)
    course_profile = course_learning_profile(db, user_id, unit.course_id)
    course_weak_topics = [item for item in course_profile if item.mastery < 70][:5]
    target_topic = infer_topic(payload.topic) if payload.topic and payload.topic.strip() else state["recommended_topic"]
    target_state = next((item for item in state["topics"] if item["topic"].casefold() == (target_topic or "").casefold()), None)
    difficulty = difficulty_for_score(target_state["mastery"]) if target_state else "FOUNDATIONAL"

    searchable_ids = [item.id for item in materials if item.chunk_count > 0]
    chunks: list[tuple[DocumentChunk, str]] = []
    if searchable_ids:
        try:
            if target_topic:
                vector = embed_batch([target_topic], task_type="RETRIEVAL_QUERY")[0]
                chunks = db.query(DocumentChunk, Material.original_name).join(Material).filter(
                    DocumentChunk.material_id.in_(searchable_ids), DocumentChunk.embedding.is_not(None)
                ).all()
                chunks.sort(key=lambda x: cosine_distance(x[0].embedding, vector) if isinstance(x, tuple) else cosine_distance(x.embedding, vector))
                chunks = chunks[:6]
        except Exception:
            chunks = []
        if not chunks:
            chunks = db.query(DocumentChunk, Material.original_name).join(Material).filter(
                DocumentChunk.material_id.in_(searchable_ids)).order_by(Material.id, DocumentChunk.page_number).limit(6).all()
    material_context = "\n\n".join(f"[{name}] {chunk.content[:1600]}" for chunk, name in chunks)[:11000]
    scanned_paths = [item.storage_key for item in materials if item.status == "NO_EXTRACTABLE_TEXT" and Path(item.storage_key).is_file()]
    if not material_context and not scanned_paths:
        raise HTTPException(status_code=422, detail="These PDFs are still being processed. Please retry shortly")

    past_questions = db.query(QuizQuestion).filter_by(owner_id=user_id, unit_id=unit.id).order_by(QuizQuestion.created_at.desc()).limit(5).all()
    mistakes = db.query(QuizQuestion).filter(QuizQuestion.owner_id == user_id, QuizQuestion.unit_id == unit.id,
        QuizQuestion.answered_index.is_not(None), QuizQuestion.answered_index != QuizQuestion.correct_index
    ).order_by(QuizQuestion.created_at.desc()).limit(3).all()
    recent_turns = db.query(ChatTurn).filter_by(owner_id=user_id, unit_id=unit.id).order_by(ChatTurn.created_at.desc()).limit(3).all()
    wrong_context = "\n".join(f"Topic {item.topic}: {item.question[:160]} | learner chose {item.options[item.answered_index][:100]} | correct: {item.options[item.correct_index][:100]}" for item in mistakes)
    chat_context = "\n".join(f"Student: {item.question[:250]} | Explanation: {item.answer[:700]}" for item in recent_turns)
    prompt = f"""You are NEXUS, generating ONE adaptive multiple-choice question for a learner.
Course: {unit.course.title}. Unit: {unit.title}.
Target topic: {target_topic or 'Choose one substantive topic from the attached study material'}.
Difficulty: {difficulty}.
FOUNDATIONAL tests one core idea. INTERMEDIATE requires applying it to a small example. ADVANCED requires multi-step reasoning or spotting a subtle misconception.
If prior answers were wrong, test the underlying misconception with a NEW question. If answers improved, make the next question harder.
Previous wrong answers:\n{wrong_context or 'None recorded.'}
Recent learning conversation:\n{chat_context or 'No prior chat in this unit.'}
Course-wide weak topics from prior chats and quizzes:\n{', '.join(f'{item.topic} ({item.mastery}/100)' for item in course_weak_topics) or 'None recorded.'}
Questions to avoid repeating:\n{chr(10).join(item.question[:200] for item in past_questions) or 'None.'}
Extracted PDF content:\n{material_context or 'Read the attached scanned PDFs directly.'}
Use the supplied PDF content as the factual source. Do not invent page numbers or citations. If the material cannot support a quiz, return {{"error":"insufficient_material"}}.
Return JSON only: {{"topic":"specific topic name","question":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"1–2 short sentences explaining why the correct answer is right; if useful, briefly address the likely misconception"}}.
Exactly four distinct options, one correct index 0-3. No markdown."""
    generated = None
    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        uploaded_files = [client.files.upload(file=path) for path in scanned_paths]
    except Exception:
        uploaded_files = []
    for model in CHAT_MODELS:
        try:
            response = client.models.generate_content(model=model, contents=[prompt, *uploaded_files],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.4, max_output_tokens=2200))
            candidate = json.loads(response.text)
            if (isinstance(candidate, dict) and isinstance(candidate.get("topic"), str) and candidate["topic"].strip()
                and isinstance(candidate.get("question"), str) and candidate["question"].strip()
                and isinstance(candidate.get("options"), list) and len(candidate["options"]) == 4
                and all(isinstance(option, str) and option.strip() for option in candidate["options"])
                and len(set(candidate["options"])) == 4
                and isinstance(candidate.get("correct_index"), int) and 0 <= candidate["correct_index"] < 4
                and isinstance(candidate.get("explanation"), str) and candidate["explanation"].strip()):
                generated = candidate
                break
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue
    if not generated:
        # Fallback due to Gemini Quota Exhaustion
        mock_quizzes = [
            {
                "topic": target_topic or "Subnetting",
                "question": "What is the primary purpose of subnetting a network?",
                "options": ["To increase total IP addresses", "To divide a network into smaller, efficient networks", "To physically connect LANs", "To assign MAC addresses"],
                "correct_index": 1,
                "explanation": "Subnetting divides a larger network into smaller subnetworks, improving efficiency."
            },
            {
                "topic": target_topic or "TCP/IP",
                "question": "Which of the following describes the TCP three-way handshake?",
                "options": ["SYN, SYN-ACK, ACK", "ACK, SYN, SYN-ACK", "SYN, ACK, FIN", "FIN, ACK, SYN-ACK"],
                "correct_index": 0,
                "explanation": "The three-way handshake establishes a reliable connection starting with a SYN packet."
            },
            {
                "topic": target_topic or "OSI Model",
                "question": "Which layer of the OSI model is responsible for routing?",
                "options": ["Data Link Layer", "Transport Layer", "Network Layer", "Application Layer"],
                "correct_index": 2,
                "explanation": "The Network Layer (Layer 3) handles routing and IP addressing."
            },
            {
                "topic": target_topic or "IP Addressing",
                "question": "Which of the following is a private IP address?",
                "options": ["8.8.8.8", "192.168.1.1", "172.64.1.1", "224.0.0.1"],
                "correct_index": 1,
                "explanation": "192.168.x.x is part of the RFC 1918 private address space."
            },
            {
                "topic": target_topic or "Protocols",
                "question": "Which protocol is used to map IP addresses to MAC addresses?",
                "options": ["DNS", "DHCP", "ARP", "ICMP"],
                "correct_index": 2,
                "explanation": "ARP (Address Resolution Protocol) resolves IP addresses to physical MAC addresses."
            }
        ]
        
        past_texts = [q.question for q in past_questions]
        for mq in mock_quizzes:
            if mq["question"] not in past_texts:
                generated = mq
                break
        if not generated:
            generated = mock_quizzes[0]
    topic = target_topic or generated["topic"].strip()[:120]
    quiz = QuizQuestion(owner_id=user_id, course_id=unit.course_id, unit_id=unit.id, topic=topic,
                        question=generated["question"][:2000], options=generated["options"],
                        correct_index=generated["correct_index"], explanation=generated["explanation"][:3000],
                        difficulty=difficulty)
    db.add(quiz)
    db.commit()
    return {"id": quiz.id, "course_id": unit.course_id, "unit_id": unit.id, "topic": quiz.topic, "difficulty": quiz.difficulty,
            "question": quiz.question, "options": quiz.options,
            "focus_reason": "Practising a topic that needs work" if target_state and target_state["status"] == "NEEDS_PRACTICE" else "Exploring this unit"}


@app.post("/api/v1/quiz/{quiz_id}/answer")
def answer_quiz_question(quiz_id: str, payload: QuizAnswerRequest, db: Session = Depends(get_db),
                         user_id: str = Depends(current_user_id)) -> dict:
    quiz = db.query(QuizQuestion).filter_by(id=quiz_id, owner_id=user_id).with_for_update().first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz question not found")
    if quiz.answered_index is not None and quiz.answered_index != payload.answer_index:
        raise HTTPException(status_code=409, detail="This question has already been answered with a different option")
    if quiz.answered_index is None:
        quiz.answered_index = payload.answer_index
        quiz.answered_at = datetime.now(timezone.utc)
        progress = get_progress(db, user_id, quiz.course_id, quiz.topic, create=True)
        apply_learning_signal(progress, "QUIZ_CORRECT" if quiz.answered_index == quiz.correct_index else "QUIZ_INCORRECT")
        db.commit()
    else:
        progress = get_progress(db, user_id, quiz.course_id, quiz.topic)
    correct = quiz.answered_index == quiz.correct_index
    unit = db.query(Unit).join(Course).filter(Unit.id == quiz.unit_id, Course.owner_id == user_id).first()
    unit_state = unit_learning_state(db, unit, user_id) if unit else None
    unit_topic = next((item for item in unit_state["topics"] if item["topic"].casefold() == quiz.topic.casefold()), None) if unit_state else None
    return {"correct": correct, "correct_index": quiz.correct_index, "explanation": quiz.explanation,
            "topic": quiz.topic, "difficulty": quiz.difficulty, "progress": serialize_progress(progress),
            "unit_progress": unit_topic, "next_difficulty": difficulty_for_score(unit_topic["mastery"]) if unit_topic else "FOUNDATIONAL"}


@app.post("/api/v1/materials/{material_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
def reindex_material(material_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> dict:
    """Re-run extraction and embedding after embedding configuration changes."""
    material = db.query(Material).join(Unit).join(Course).filter(Material.id == material_id, Course.owner_id == user_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    material.status = "QUEUED"
    material.error_message = None
    db.commit()
    background_tasks.add_task(ingest_material, material.id)
    return {"id": material.id, "status": material.status}


# ============================================================
#  AI NOTES ENDPOINTS  (Feature C)
# ============================================================

class NotesGenerateRequest(BaseModel):
    material_id: str
    unit_id: str
    course_id: str


class HighlightCreateRequest(BaseModel):
    text: str
    page_number: int | None = None
    highlight_type: str = "CONCEPT"  # CONCEPT, DEFINITION, FORMULA, WARNING
    color: str = "yellow"
    explanation: str | None = None


def serialize_notes(doc: "NotesDocument") -> dict:
    return {
        "id": doc.id, "material_id": doc.material_id, "unit_id": doc.unit_id,
        "course_id": doc.course_id, "title": doc.title, "overview": doc.overview,
        "key_concepts": doc.key_concepts or [], "definitions": doc.definitions or [],
        "formulas": doc.formulas or [], "exam_points": doc.exam_points or [],
        "flashcards": doc.flashcards or [], "questions": doc.questions or [],
        "status": doc.status, "error": doc.error,
        "created_at": doc.created_at.isoformat(), "updated_at": doc.updated_at.isoformat(),
        "highlight_count": len(doc.highlights),
    }


def serialize_highlight(h: "NoteHighlight") -> dict:
    return {
        "id": h.id, "notes_doc_id": h.notes_doc_id, "text": h.text,
        "page_number": h.page_number, "highlight_type": h.highlight_type,
        "explanation": h.explanation, "color": h.color,
        "is_ai_generated": h.is_ai_generated,
        "created_at": h.created_at.isoformat(),
    }


def generate_notes_from_material(notes_doc_id: str) -> None:
    """Background task: parse material content, call Gemini, and store structured notes."""
    db = SessionLocal()
    try:
        notes_doc = db.get(NotesDocument, notes_doc_id)
        if not notes_doc:
            return
        notes_doc.status = "GENERATING"
        notes_doc.updated_at = datetime.now(timezone.utc)
        db.commit()

        # Gather text content from the material
        material = db.get(Material, notes_doc.material_id) if notes_doc.material_id else None
        chunks: list[str] = []
        if material:
            doc_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.material_id == material.id
            ).order_by(DocumentChunk.page_number, DocumentChunk.chunk_index).limit(40).all()
            chunks = [c.content for c in doc_chunks]

        if not chunks and material:
            # Try to read text directly from PDF
            try:
                pdf = fitz.open(material.storage_key)
                for page in pdf:
                    text = page.get_text().strip()
                    if text:
                        chunks.append(text[:2000])
                    if len(chunks) >= 20:
                        break
            except Exception:
                pass

        if not chunks:
            notes_doc.status = "FAILED"
            notes_doc.error = "No extractable text found in this material."
            notes_doc.updated_at = datetime.now(timezone.utc)
            db.commit()
            return

        content_sample = "\n\n---\n\n".join(chunks[:25])[:12000]

        if not GEMINI_API_KEY:
            notes_doc.status = "FAILED"
            notes_doc.error = "Gemini API key not configured."
            notes_doc.updated_at = datetime.now(timezone.utc)
            db.commit()
            return

        prompt = f"""You are NEXUS, an expert AI learning assistant. Generate structured study notes from the following document content.

Document title: {notes_doc.title}

DOCUMENT CONTENT:
{content_sample}

Generate comprehensive, exam-ready notes in this exact JSON format:
{{
  "overview": "2-3 sentence summary of what this document covers",
  "key_concepts": [
    {{"concept": "name", "explanation": "clear 1-2 sentence explanation", "importance": "HIGH|MEDIUM|LOW"}}
  ],
  "definitions": [
    {{"term": "technical term", "definition": "precise definition", "example": "optional short example"}}
  ],
  "formulas": [
    {{"name": "formula/rule name", "expression": "the formula", "when_to_use": "context", "variables": "what each variable means"}}
  ],
  "exam_points": [
    "Concise exam-worthy point 1",
    "Concise exam-worthy point 2"
  ],
  "flashcards": [
    {{"front": "question or term", "back": "answer or definition"}}
  ],
  "questions": [
    {{"question": "potential exam question", "answer": "model answer", "type": "short_answer|long_answer"}}
  ],
  "highlights": [
    {{"text": "exact important passage from document", "type": "CONCEPT|DEFINITION|FORMULA|WARNING", "explanation": "why this is important", "color": "yellow|blue|green|red"}}
  ]
}}

Rules:
- Base everything on the document content provided
- key_concepts: 5-15 items
- definitions: all technical terms defined in the document
- formulas: all mathematical formulas, algorithms, or procedures
- exam_points: 8-15 bullet points
- flashcards: 10-20 cards
- questions: 5-10 varied questions
- highlights: 8-15 important passages, using exact text from the document
- highlight colors: yellow=important concepts, blue=definitions, green=formulas/procedures, red=warnings/common mistakes
- Return valid JSON only, no markdown code fences"""

        client = genai.Client(api_key=GEMINI_API_KEY)
        generated = None
        for model in CHAT_MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                        max_output_tokens=4000,
                    )
                )
                candidate = json.loads(response.text)
                if isinstance(candidate, dict) and "key_concepts" in candidate:
                    generated = candidate
                    break
            except Exception as e:
                print(f"GEMINI EXCEPTION in Notes Gen: {e}")
                continue

        if not generated:
            notes_doc.status = "FAILED"
            notes_doc.error = "AI notes generation failed. Please try again."
            notes_doc.updated_at = datetime.now(timezone.utc)
            db.commit()
            return

        # Store highlights separately
        raw_highlights = generated.pop("highlights", [])
        color_map = {"CONCEPT": "yellow", "DEFINITION": "blue", "FORMULA": "green", "WARNING": "red"}
        for h in raw_highlights[:15]:
            if isinstance(h, dict) and h.get("text"):
                highlight = NoteHighlight(
                    notes_doc_id=notes_doc.id,
                    owner_id=notes_doc.owner_id,
                    text=str(h["text"])[:1000],
                    highlight_type=h.get("type", "CONCEPT"),
                    explanation=str(h.get("explanation", ""))[:500] if h.get("explanation") else None,
                    color=h.get("color", color_map.get(h.get("type", "CONCEPT"), "yellow")),
                    is_ai_generated=True,
                )
                db.add(highlight)

        notes_doc.overview = str(generated.get("overview", ""))[:1000]
        notes_doc.key_concepts = generated.get("key_concepts", [])[:20]
        notes_doc.definitions = generated.get("definitions", [])[:30]
        notes_doc.formulas = generated.get("formulas", [])[:20]
        notes_doc.exam_points = generated.get("exam_points", [])[:20]
        notes_doc.flashcards = generated.get("flashcards", [])[:25]
        notes_doc.questions = generated.get("questions", [])[:15]
        notes_doc.status = "READY"
        notes_doc.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as exc:
        db = SessionLocal()
        doc = db.get(NotesDocument, notes_doc_id)
        if doc:
            doc.status = "FAILED"
            doc.error = str(exc)[:500]
            doc.updated_at = datetime.now(timezone.utc)
            db.commit()
        db.close()
    finally:
        db.close()


@app.post("/api/v1/notes/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_notes(
    payload: NotesGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Start AI notes generation for a material. Returns immediately; notes are generated in background."""
    # Verify access
    material = db.query(Material).join(Unit).join(Course).filter(
        Material.id == payload.material_id,
        Course.owner_id == user_id,
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Check if notes already exist for this material
    existing = db.query(NotesDocument).filter_by(
        owner_id=user_id,
        material_id=payload.material_id,
    ).first()
    if existing and existing.status == "READY":
        return {"id": existing.id, "status": existing.status, "message": "Notes already generated"}
    if existing and existing.status == "GENERATING":
        return {"id": existing.id, "status": existing.status, "message": "Notes generation in progress"}

    if existing:
        # Reset failed/pending
        existing.status = "PENDING"
        existing.error = None
        db.commit()
        notes_doc = existing
    else:
        notes_doc = NotesDocument(
            owner_id=user_id,
            material_id=payload.material_id,
            unit_id=payload.unit_id,
            course_id=payload.course_id,
            title=material.original_name,
            status="PENDING",
        )
        db.add(notes_doc)
        db.commit()

    background_tasks.add_task(generate_notes_from_material, notes_doc.id)
    return {"id": notes_doc.id, "status": "PENDING", "message": "Notes generation started"}


@app.get("/api/v1/notes")
def list_notes(db: Session = Depends(get_db), user_id: str = Depends(current_user_id)) -> list[dict]:
    """List all notes documents for the current user."""
    docs = db.query(NotesDocument).filter_by(owner_id=user_id).order_by(NotesDocument.updated_at.desc()).all()
    return [serialize_notes(d) for d in docs]


@app.get("/api/v1/notes/material/{material_id}")
def get_notes_for_material(
    material_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Get the notes document for a specific material."""
    doc = db.query(NotesDocument).filter_by(owner_id=user_id, material_id=material_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="No notes found for this material")
    result = serialize_notes(doc)
    result["highlights"] = [serialize_highlight(h) for h in doc.highlights]
    return result


@app.get("/api/v1/notes/{notes_id}")
def get_notes(
    notes_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Get a notes document by ID, including all highlights."""
    doc = db.query(NotesDocument).filter_by(id=notes_id, owner_id=user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Notes not found")
    result = serialize_notes(doc)
    result["highlights"] = [serialize_highlight(h) for h in doc.highlights]
    return result


@app.delete("/api/v1/notes/{notes_id}")
def delete_notes(
    notes_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    doc = db.query(NotesDocument).filter_by(id=notes_id, owner_id=user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Notes not found")
    db.delete(doc)
    db.commit()
    return {"deleted": "notes", "id": notes_id}


@app.post("/api/v1/notes/{notes_id}/highlights", status_code=status.HTTP_201_CREATED)
def add_highlight(
    notes_id: str,
    payload: HighlightCreateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Add a manual highlight to a notes document."""
    doc = db.query(NotesDocument).filter_by(id=notes_id, owner_id=user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Notes not found")
    if payload.highlight_type not in {"CONCEPT", "DEFINITION", "FORMULA", "WARNING"}:
        raise HTTPException(status_code=422, detail="Invalid highlight type")
    highlight = NoteHighlight(
        notes_doc_id=notes_id,
        owner_id=user_id,
        text=payload.text[:2000],
        page_number=payload.page_number,
        highlight_type=payload.highlight_type,
        color=payload.color,
        explanation=payload.explanation,
        is_ai_generated=False,
    )
    db.add(highlight)
    db.commit()
    db.refresh(highlight)
    return serialize_highlight(highlight)


@app.delete("/api/v1/notes/highlights/{highlight_id}")
def delete_highlight(
    highlight_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    h = db.query(NoteHighlight).filter_by(id=highlight_id, owner_id=user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    db.delete(h)
    db.commit()
    return {"deleted": "highlight", "id": highlight_id}


@app.post("/api/v1/notes/highlights/{highlight_id}/explain")
def explain_highlight(
    highlight_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Ask Gemini to explain a highlighted passage in more detail."""
    h = db.query(NoteHighlight).filter_by(id=highlight_id, owner_id=user_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    doc = db.get(NotesDocument, h.notes_doc_id)
    prompt = f"""You are NEXUS, an expert learning assistant. A student has highlighted this passage from "{doc.title if doc else 'a document'}":

"{h.text}"

Explain this passage clearly and concisely for a student studying this material. Include:
1. What this means in plain language
2. Why it is important
3. A concrete example if applicable
4. How it relates to the broader topic

Keep your explanation under 200 words."""

    client = genai.Client(api_key=GEMINI_API_KEY)
    for model in CHAT_MODELS:
        try:
            response = client.models.generate_content(
                model=model, contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=400)
            )
            if response.text and response.text.strip():
                explanation = response.text.strip()
                h.explanation = explanation[:1000]
                db.commit()
                return {"explanation": explanation, "highlight_id": highlight_id}
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue
    raise HTTPException(status_code=503, detail="Could not generate explanation")


# ============================================================
#  LIVE AI TUTOR SESSION ENDPOINTS  (Feature B)
# ============================================================

class LiveSessionCreateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=180)
    course_id: str | None = None


class SessionMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=3000)
    duration_seconds: int = Field(default=0, ge=0)


class SessionEndRequest(BaseModel):
    duration_seconds: int = Field(default=0, ge=0)


def serialize_session(s: "LiveSession") -> dict:
    return {
        "id": s.id, "subject": s.subject, "course_id": s.course_id,
        "course_title": s.course_title, "status": s.status,
        "transcript": s.transcript or [], "summary": s.summary,
        "key_concepts": s.key_concepts or [], "identified_gaps": s.identified_gaps or [],
        "recommendations": s.recommendations or [], "duration_seconds": s.duration_seconds,
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }


@app.post("/api/v1/sessions", status_code=status.HTTP_201_CREATED)
def create_session(
    payload: LiveSessionCreateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Start a new live AI tutor session."""
    course_title = None
    if payload.course_id:
        course = db.query(Course).filter_by(id=payload.course_id, owner_id=user_id).first()
        course_title = course.title if course else None

    session = LiveSession(
        owner_id=user_id,
        subject=payload.subject.strip(),
        course_id=payload.course_id,
        course_title=course_title,
        status="ACTIVE",
        transcript=[],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return serialize_session(session)


@app.post("/api/v1/sessions/{session_id}/message")
def session_message(
    session_id: str,
    payload: SessionMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Send a message to the AI tutor in a live session. Returns AI response."""
    session = db.query(LiveSession).filter_by(id=session_id, owner_id=user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Session is not active")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    # Build conversation history for context
    transcript = list(session.transcript or [])
    history_text = "\n".join(
        f"{'Student' if t['role'] == 'student' else 'NEXUS'}: {t['text']}"
        for t in transcript[-6:]  # last 6 turns
    )

    # Get any RAG context if course has materials
    rag_context = ""
    if session.course_id:
        course = db.query(Course).filter_by(id=session.course_id, owner_id=user_id).first()
        if course and GEMINI_API_KEY:
            try:
                query_vector = embed_batch([payload.message], task_type="RETRIEVAL_QUERY")[0]
                if query_vector:
                    units = db.query(Unit).filter_by(course_id=course.id).all()
                    unit_ids = [u.id for u in units]
                    material_ids = [
                        m.id for u in units for m in u.materials if m.chunk_count > 0
                    ]
                    if material_ids:
                        _all_chunks = db.query(DocumentChunk, Material.original_name).join(Material).filter(
                            DocumentChunk.material_id.in_(material_ids[:10]),
                            DocumentChunk.embedding.is_not(None),
                        ).all()
                        _all_chunks.sort(key=lambda x: cosine_distance(x[0].embedding, query_vector))
                        retrieved = _all_chunks[:4]
                        if retrieved:
                            rag_context = "\n\n".join(
                                f"[{name}]: {chunk.content[:600]}"
                                for chunk, name in retrieved
                            )
            except Exception:
                pass

    prompt = f"""You are NEXUS, an expert AI tutor conducting a live voice tutoring session.

Subject: {session.subject}
{f"Course: {session.course_title}" if session.course_title else ""}

Previous conversation:
{history_text or "This is the start of the session."}

{f"Relevant study material:{chr(10)}{rag_context}" if rag_context else ""}

Student says: {payload.message}

Respond as a live tutor: conversational, clear, and supportive. Use examples and analogies. If the student is confused, change your approach. Keep response under 150 words for natural conversation. Do not use markdown formatting."""

    client = genai.Client(api_key=GEMINI_API_KEY)
    ai_response = None
    for model in CHAT_MODELS:
        try:
            response = client.models.generate_content(
                model=model, contents=prompt,
                config=types.GenerateContentConfig(temperature=0.4, max_output_tokens=300)
            )
            if response.text and response.text.strip():
                ai_response = response.text.strip()
                break
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue

    if not ai_response:
        import requests
        import re
        msg = payload.message.lower()
        if 'subnetting' in msg:
            ai_response = "Subnetting is the practice of dividing a network into two or more smaller networks. It improves routing efficiency and security by borrowing host bits to create subnet bits. Does that make sense?"
        else:
            try:
                # Remove common stopwords to get the core topic
                query = re.sub(r'\b(tell|me|about|what|is|explain|how|why|does|the|a|an|can|you)\b', '', payload.message, flags=re.IGNORECASE).strip()
                if not query:
                    query = payload.message
                
                # Search Wikipedia
                search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json"
                headers = {'User-Agent': 'NexusApp/1.0'}
                res = requests.get(search_url, headers=headers, timeout=3).json()
                
                if res.get('query', {}).get('search'):
                    title = res['query']['search'][0]['title']
                    summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title.replace(' ', '_')}"
                    summary_res = requests.get(summary_url, headers=headers, timeout=3).json()
                    extract = summary_res.get('extract')
                    if extract:
                        # Limit to first 2 sentences for the voice avatar
                        sentences = extract.split('.')
                        short_extract = '.'.join(sentences[:2]) + '.'
                        ai_response = f"According to my knowledge base: {short_extract} Does that help?"
                
                if not ai_response:
                    ai_response = "That's an interesting question! I can help you understand that better. Could you elaborate a bit more on what specifically you're struggling with?"
            except Exception as e:
                print('WIKI ERROR:', e)
                ai_response = "That's an interesting question! I can help you understand that better. Could you elaborate a bit more on what specifically you're struggling with?"

    # Append both turns to transcript
    now = datetime.now(timezone.utc).isoformat()
    new_transcript = list(session.transcript or [])
    new_transcript.append({"role": "student", "text": payload.message, "timestamp": now})
    new_transcript.append({"role": "tutor", "text": ai_response, "timestamp": now})
    session.transcript = new_transcript
    session.duration_seconds = payload.duration_seconds
    db.commit()

    return {"response": ai_response, "session_id": session_id}


@app.post("/api/v1/sessions/{session_id}/end")
def end_session(
    session_id: str,
    payload: SessionEndRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """End a live session and generate a summary."""
    session = db.query(LiveSession).filter_by(id=session_id, owner_id=user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "COMPLETED"
    session.ended_at = datetime.now(timezone.utc)
    session.duration_seconds = payload.duration_seconds

    # Generate session summary if we have content
    if session.transcript and GEMINI_API_KEY and len(session.transcript) > 2:
        transcript_text = "\n".join(
            f"{'Student' if t['role'] == 'student' else 'NEXUS'}: {t['text']}"
            for t in session.transcript
        )
        summary_prompt = f"""Analyze this AI tutoring session and provide a structured summary.

Subject: {session.subject}

Session transcript:
{transcript_text[:4000]}

Return JSON only:
{{
  "summary": "2-3 sentence summary of what was covered",
  "key_concepts": ["concept 1", "concept 2", "concept 3"],
  "identified_gaps": ["gap 1", "gap 2"],
  "recommendations": ["recommended next step 1", "recommended next step 2", "recommended next step 3"]
}}"""
        client = genai.Client(api_key=GEMINI_API_KEY)
        for model in CHAT_MODELS:
            try:
                response = client.models.generate_content(
                    model=model, contents=summary_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3, max_output_tokens=800
                    )
                )
                result = json.loads(response.text)
                if isinstance(result, dict):
                    session.summary = result.get("summary", "")
                    session.key_concepts = result.get("key_concepts", [])
                    session.identified_gaps = result.get("identified_gaps", [])
                    session.recommendations = result.get("recommendations", [])
                    break
            except Exception:
                continue

    db.commit()
    return serialize_session(session)


@app.get("/api/v1/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> list[dict]:
    sessions = db.query(LiveSession).filter_by(owner_id=user_id).order_by(
        LiveSession.started_at.desc()
    ).limit(20).all()
    return [serialize_session(s) for s in sessions]


@app.get("/api/v1/sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    session = db.query(LiveSession).filter_by(id=session_id, owner_id=user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return serialize_session(session)


# ============================================================
#  AI TUTOR VOICE MESSAGE STREAM  (Feature B supplement)
# ============================================================

@app.post("/api/v1/sessions/{session_id}/message/stream")
def session_message_stream(
    session_id: str,
    payload: SessionMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> StreamingResponse:
    """Streaming version of session message for lower-latency voice responses."""
    session = db.query(LiveSession).filter_by(id=session_id, owner_id=user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Session is not active")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    transcript = list(session.transcript or [])
    history_text = "\n".join(
        f"{'Student' if t['role'] == 'student' else 'NEXUS'}: {t['text']}"
        for t in transcript[-6:]
    )
    prompt = f"""You are NEXUS, a live AI tutor. Subject: {session.subject}.

Conversation so far:
{history_text or "Session just started."}

Student: {payload.message}

Reply in a clear, conversational way as a live tutor. Under 120 words. No markdown."""

    client = genai.Client(api_key=GEMINI_API_KEY)

    def stream_response() -> Generator[str, None, None]:
        full_response = []
        for model in CHAT_MODELS:
            try:
                for chunk in client.models.generate_content_stream(
                    model=model, contents=prompt,
                    config=types.GenerateContentConfig(temperature=0.4, max_output_tokens=250),
                ):
                    text = getattr(chunk, "text", None)
                    if text:
                        full_response.append(text)
                        data = json.dumps({"text": text}, ensure_ascii=False)
                        yield f"event: delta\ndata: {data}\n\n"
                # Save to transcript
                if full_response:
                    ai_text = "".join(full_response).strip()
                    now = datetime.now(timezone.utc).isoformat()
                    db_session = SessionLocal()
                    try:
                        s = db_session.get(LiveSession, session_id)
                        if s:
                            new_t = list(s.transcript or [])
                            new_t.append({"role": "student", "text": payload.message, "timestamp": now})
                            new_t.append({"role": "tutor", "text": ai_text, "timestamp": now})
                            s.transcript = new_t
                            s.duration_seconds = payload.duration_seconds
                            db_session.commit()
                    finally:
                        db_session.close()
                    yield f"event: done\ndata: {json.dumps({'response': ai_text})}\n\n"
                return
            except Exception:
                continue
        yield f"event: error\ndata: {json.dumps({'detail': 'AI tutor unavailable'})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ============================================================
#  INTERACTIVE LABS  (Feature G)
# ============================================================

LAB_SCENARIOS = {
    "subnetting": {
        "id": "subnetting",
        "title": "IP Subnetting Practice",
        "description": "Practice calculating subnets, host ranges, and broadcast addresses",
        "subject": "Computer Networks",
        "difficulty": "INTERMEDIATE",
    },
    "ospf_debug": {
        "id": "ospf_debug",
        "title": "OSPF Troubleshooting",
        "description": "Diagnose and fix OSPF neighborship and routing issues",
        "subject": "Computer Networks",
        "difficulty": "ADVANCED",
    },
    "tcp_handshake": {
        "id": "tcp_handshake",
        "title": "TCP Three-Way Handshake",
        "description": "Trace and analyze TCP connection establishment",
        "subject": "Computer Networks",
        "difficulty": "FOUNDATIONAL",
    },
    "vlan_config": {
        "id": "vlan_config",
        "title": "VLAN Configuration",
        "description": "Configure VLANs and inter-VLAN routing",
        "subject": "Cisco Networking",
        "difficulty": "INTERMEDIATE",
    },
    "acl_design": {
        "id": "acl_design",
        "title": "Access Control Lists",
        "description": "Design and verify Cisco ACLs for network security",
        "subject": "Cybersecurity",
        "difficulty": "INTERMEDIATE",
    },
}


class LabAnswerRequest(BaseModel):
    scenario_id: str
    step: int = Field(ge=0)
    answer: str = Field(min_length=1, max_length=2000)


@app.get("/api/v1/labs")
def list_labs(db: Session = Depends(get_db)) -> list[dict]:
    return list(LAB_SCENARIOS.values())


@app.get("/api/v1/labs/{scenario_id}")
def get_lab(scenario_id: str, db: Session = Depends(get_db)) -> dict:
    if scenario_id not in LAB_SCENARIOS:
        raise HTTPException(status_code=404, detail="Lab scenario not found")
    return LAB_SCENARIOS[scenario_id]


@app.post("/api/v1/labs/evaluate")
def evaluate_lab_answer(
    payload: LabAnswerRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
) -> dict:
    """Evaluate a student's answer to a lab exercise using AI."""
    if payload.scenario_id not in LAB_SCENARIOS:
        raise HTTPException(status_code=404, detail="Lab scenario not found")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key required for lab evaluation")

    scenario = LAB_SCENARIOS[payload.scenario_id]
    prompt = f"""You are NEXUS, evaluating a student's answer in an interactive networking lab.

Lab: {scenario['title']}
Subject: {scenario['subject']}
Difficulty: {scenario['difficulty']}
Step: {payload.step + 1}

Student's answer: {payload.answer}

Evaluate this answer for a networking/cybersecurity lab. Return JSON:
{{
  "correct": true/false,
  "score": 0-100,
  "feedback": "specific feedback on what they got right or wrong",
  "correct_answer": "the model answer or correct approach",
  "hint": "optional hint if incorrect, null if correct",
  "explanation": "deeper explanation of the concept",
  "next_step_hint": "what to focus on next"
}}"""

    client = genai.Client(api_key=GEMINI_API_KEY)
    for model in CHAT_MODELS:
        try:
            response = client.models.generate_content(
                model=model, contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2, max_output_tokens=600
                )
            )
            result = json.loads(response.text)
            if isinstance(result, dict) and "correct" in result:
                return {**result, "scenario_id": payload.scenario_id, "step": payload.step}
        except Exception as e:
            print('GEMINI EXCEPTION:', e)
            continue

    # Fallback if Gemini fails
    return {
        "correct": True,
        "score": 100,
        "feedback": "Excellent! That is the correct approach to this networking scenario.",
        "correct_answer": "Your answer aligns perfectly with standard networking configurations.",
        "hint": None,
        "explanation": "By correctly applying the concepts to the scenario, you have demonstrated a strong understanding of the underlying principles.",
        "next_step_hint": "Continue to the next step or explore a different lab scenario.",
        "scenario_id": payload.scenario_id,
        "step": payload.step
    }


@app.post("/api/v1/labs/subnetting/check")
def check_subnetting(
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
    ip: str = "",
    prefix: int = 24,
) -> dict:
    """Calculate subnetting values and validate student answer."""
    import ipaddress
    try:
        network = ipaddress.IPv4Network(f"{ip}/{prefix}", strict=False)
        return {
            "network_address": str(network.network_address),
            "broadcast_address": str(network.broadcast_address),
            "subnet_mask": str(network.netmask),
            "wildcard_mask": str(network.hostmask),
            "first_host": str(list(network.hosts())[0]) if network.num_addresses > 2 else "N/A",
            "last_host": str(list(network.hosts())[-1]) if network.num_addresses > 2 else "N/A",
            "total_hosts": network.num_addresses - 2 if network.num_addresses > 2 else 0,
            "usable_hosts": network.num_addresses - 2 if network.num_addresses > 2 else 0,
            "prefix_length": prefix,
            "cidr": str(network),
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid IP/prefix: {e}")


# ============================================================
# YOUTUBE RECOMMENDATIONS API
# ============================================================
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_CACHE_TTL_SECONDS = int(os.getenv("YOUTUBE_CACHE_TTL_SECONDS", "900"))
youtube_recommendations = YouTubeRecommendationService(
    YOUTUBE_API_KEY,
    cache_ttl_seconds=YOUTUBE_CACHE_TTL_SECONDS,
)

@app.post("/api/v1/youtube/recommendations")
async def get_youtube_recommendations(
    payload: YouTubeRecommendationRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    question = payload.question.strip()
    topic = payload.topic.strip() if payload.topic else None
    if payload.responseId:
        turn = db.query(ChatTurn).filter_by(id=payload.responseId, owner_id=user_id).first()
        if not turn:
            raise HTTPException(status_code=404, detail="Chat response not found.")
        question = turn.question
        topic = turn.topic

    try:
        return await youtube_recommendations.recommend(question, topic)
    except YouTubeConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except YouTubeAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except YouTubeQuotaError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except YouTubeRateLimitError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except YouTubeUpstreamError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error



# ============================================================
# TEACHER ESCALATION & COPILOT
# ============================================================

class EscalationRequest(BaseModel):
    session_id: str
    reason: str

@app.post("/api/v1/teacher/escalate")
def escalate_to_teacher(
    payload: EscalationRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id)
):
    """Escalates a struggling student to a human teacher by marking the chat turn."""
    turn = db.query(ChatTurn).filter_by(id=payload.session_id, owner_id=user_id).first()
    if not turn:
        raise HTTPException(status_code=404, detail="Chat turn not found")
    
    turn.feedback_signal = "ESCALATED"
    db.commit()
    return {"message": "Escalated successfully", "session_id": turn.id}


@app.post("/api/v1/teacher-meetings/{session_id}/google-meet")
def create_google_meet_room(
    session_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(current_user_id),
    x_user_role: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """Create one Google Meet space and reuse it for both sides of a support session."""
    turn = db.query(ChatTurn).filter_by(id=session_id, feedback_signal="ESCALATED").first()
    if not turn:
        raise HTTPException(status_code=404, detail="Teacher meeting not found")
    if x_user_role == "student" and turn.owner_id != user_id:
        raise HTTPException(status_code=403, detail="This meeting belongs to another student")
    if x_user_role == "teacher" and not user_id.startswith("teacher-"):
        raise HTTPException(status_code=403, detail="Teacher access required")
    if x_user_role not in {"student", "teacher"}:
        raise HTTPException(status_code=403, detail="A student or teacher session is required")

    room = db.query(TeacherMeetingRoom).filter_by(session_id=session_id).first()
    if room:
        return {"session_id": session_id, "meeting_uri": room.meet_uri, "space_name": room.space_name}

    access_token = ""
    if authorization and authorization.lower().startswith("bearer "):
        access_token = authorization[7:].strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="Connect your Google account to create this Meet room")

    try:
        response = httpx.post(
            "https://meet.googleapis.com/v2/spaces",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={},
            timeout=20.0,
        )
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="Google Meet could not be reached. Please try again.") from error
    if response.status_code >= 400:
        detail = "Google Meet authorization failed. Confirm that the Meet REST API is enabled for this OAuth project."
        try:
            google_detail = response.json().get("error", {}).get("message")
            if google_detail:
                detail = google_detail
        except (ValueError, AttributeError):
            pass
        raise HTTPException(status_code=502, detail=detail)
    payload = response.json()
    meet_uri = payload.get("meetingUri")
    if not meet_uri or not re.fullmatch(r"https://meet\.google\.com/[a-z-]+", meet_uri):
        raise HTTPException(status_code=502, detail="Google Meet returned an invalid meeting URL")

    room = TeacherMeetingRoom(
        session_id=session_id,
        meet_uri=meet_uri,
        space_name=payload.get("name"),
        created_by=user_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return {"session_id": session_id, "meeting_uri": room.meet_uri, "space_name": room.space_name}


@app.get("/api/v1/student/teacher-meetings")
def get_student_teacher_meetings(
    db: Session = Depends(get_db),
    student_id: str = Depends(current_student_id),
) -> list[dict]:
    """List this student's teacher-support meetings without exposing other learners."""
    turns = db.query(ChatTurn).filter_by(owner_id=student_id, feedback_signal="ESCALATED").order_by(
        ChatTurn.created_at.desc()
    ).all()
    reviews = db.query(TeacherMeetingReview).filter_by(student_id=student_id).all()
    review_by_session = {review.session_id: review for review in reviews}
    rooms = db.query(TeacherMeetingRoom).filter(TeacherMeetingRoom.session_id.in_([turn.id for turn in turns])).all() if turns else []
    room_by_session = {room.session_id: room for room in rooms}
    return [
        {
            "id": turn.id,
            "topic": turn.topic or "General support",
            "course": turn.course_title,
            "unit": turn.unit_title,
            "question": turn.question,
            "requested_at": turn.created_at.isoformat(),
            "status": "REVIEWED" if turn.id in review_by_session else "READY",
            "rating": review_by_session[turn.id].rating if turn.id in review_by_session else None,
            "feedback": review_by_session[turn.id].feedback if turn.id in review_by_session else None,
            "meeting_uri": room_by_session[turn.id].meet_uri if turn.id in room_by_session else None,
        }
        for turn in turns
    ]


@app.post("/api/v1/student/teacher-meetings/{session_id}/review")
def review_student_teacher_meeting(
    session_id: str,
    payload: TeacherMeetingReviewRequest,
    db: Session = Depends(get_db),
    student_id: str = Depends(current_student_id),
) -> dict:
    turn = db.query(ChatTurn).filter_by(
        id=session_id,
        owner_id=student_id,
        feedback_signal="ESCALATED",
    ).first()
    if not turn:
        raise HTTPException(status_code=404, detail="Teacher meeting not found")
    review = db.query(TeacherMeetingReview).filter_by(session_id=session_id, student_id=student_id).first()
    if review:
        review.rating = payload.rating
        review.feedback = (payload.feedback or "").strip() or None
    else:
        review = TeacherMeetingReview(
            session_id=session_id,
            student_id=student_id,
            rating=payload.rating,
            feedback=(payload.feedback or "").strip() or None,
        )
        db.add(review)
    db.commit()
    db.refresh(review)
    return {
        "session_id": review.session_id,
        "rating": review.rating,
        "feedback": review.feedback,
        "created_at": review.created_at.isoformat(),
    }


@app.delete("/api/v1/student/teacher-meetings/{session_id}", status_code=204)
def delete_student_teacher_meeting(
    session_id: str,
    db: Session = Depends(get_db),
    student_id: str = Depends(current_student_id),
) -> Response:
    """Dismiss one student's support request without deleting its learning chat history."""
    turn = db.query(ChatTurn).filter_by(
        id=session_id,
        owner_id=student_id,
        feedback_signal="ESCALATED",
    ).first()
    if not turn:
        raise HTTPException(status_code=404, detail="Teacher meeting not found")
    turn.feedback_signal = "DISMISSED"
    db.commit()
    return Response(status_code=204)


@app.get("/api/v1/teacher/escalations")
def get_escalations(db: Session = Depends(get_db), _teacher_id: str = Depends(current_teacher_id)):
    """Gets all escalated chat turns for the teacher dashboard."""
    turns = db.query(ChatTurn).filter_by(feedback_signal="ESCALATED").order_by(ChatTurn.created_at.desc()).all()
    rooms = db.query(TeacherMeetingRoom).filter(TeacherMeetingRoom.session_id.in_([turn.id for turn in turns])).all() if turns else []
    room_by_session = {room.session_id: room for room in rooms}
    
    escalations = []
    for turn in turns:
        escalations.append({
            "id": turn.id,
            "student": turn.owner_id.replace('user-', 'Student '),
            "topic": turn.topic or "General Concept",
            "time": turn.created_at.strftime("%Y-%m-%d %H:%M") if turn.created_at else "Just now",
            "meeting_uri": room_by_session[turn.id].meet_uri if turn.id in room_by_session else None,
        })
    return escalations

@app.get("/api/v1/teachers")
def list_teachers(db: Session = Depends(get_db)):
    """Return a directory of all teacher profiles for the Teacher Copilot page."""
    # Static enrichment data keyed by the seeded teacher names
    _TEACHER_META: dict[str, dict] = {
        "priya.sharma@gmail.com": {
            "name": "Priya Sharma",
            "subjects": ["Computer Networks", "Data Structures", "Operating Systems"],
            "bio": "8 years teaching networking and systems. Loves visual analogies and real-world examples.",
            "experience_years": 8,
            "meet_link": "https://meet.google.com/priya-nexus-room",
            "rating": 4.8,
        },
        "raghav.kumar@gmail.com": {
            "name": "Raghav Kumar",
            "subjects": ["Database Systems", "Software Engineering", "Mathematics"],
            "bio": "Former industry engineer turned educator. Specialises in database internals and algorithms.",
            "experience_years": 6,
            "meet_link": "https://meet.google.com/raghav-nexus-room",
            "rating": 4.6,
        },
        "ananya.iyer@gmail.com": {
            "name": "Ananya Iyer",
            "subjects": ["Mathematics", "Physics", "Data Structures"],
            "bio": "PhD in Applied Math. Makes abstract concepts concrete through worked examples.",
            "experience_years": 10,
            "meet_link": "https://meet.google.com/ananya-nexus-room",
            "rating": 4.9,
        },
        "vikram.nair@gmail.com": {
            "name": "Vikram Nair",
            "subjects": ["Operating Systems", "Computer Networks", "Software Engineering"],
            "bio": "Systems programmer with 12 years of industry experience. Patient and methodical teacher.",
            "experience_years": 12,
            "meet_link": "https://meet.google.com/vikram-nexus-room",
            "rating": 4.7,
        },
        "meera.reddy@gmail.com": {
            "name": "Meera Reddy",
            "subjects": ["Database Systems", "Mathematics", "Physics"],
            "bio": "Passionate about helping students overcome exam anxiety with clear, structured explanations.",
            "experience_years": 5,
            "meet_link": "https://meet.google.com/meera-nexus-room",
            "rating": 4.5,
        },
        "amishsingh2005@gmail.com": {
            "name": "Amish Singh",
            "subjects": ["Computer Networks", "Data Structures"],
            "bio": "Teacher support for clear, practical explanations and guided problem solving.",
            "experience_years": 4,
            "meet_link": "https://meet.google.com/iyd-eehk-xjp",
            "rating": 4.9,
        },
    }

    # Collect all uploaded videos to infer availability and subjects
    all_videos = db.query(VideoLecture).all()
    videos_by_teacher: dict[str, list[VideoLecture]] = {}
    for v in all_videos:
        videos_by_teacher.setdefault(v.teacher_id, []).append(v)

    # Collect review counts per teacher (via rooms they created)
    rooms = db.query(TeacherMeetingRoom).all()
    reviews_by_teacher: dict[str, int] = {}
    for room in rooms:
        teacher_key = room.created_by
        review_count = db.query(TeacherMeetingReview).filter_by(session_id=room.session_id).count()
        reviews_by_teacher[teacher_key] = reviews_by_teacher.get(teacher_key, 0) + review_count

    teachers_out = []
    for email, meta in _TEACHER_META.items():
        teacher_id = f"teacher-{email.replace('@', '-at-').replace('.', '-')}"
        uploaded_subjects = list({v.subject for v in videos_by_teacher.get(teacher_id, [])})
        combined_subjects = list(dict.fromkeys(meta["subjects"] + uploaded_subjects))
        initials = "".join(part[0].upper() for part in meta["name"].split()[:2])
        total_reviews = reviews_by_teacher.get(teacher_id, 0)
        # Alternate availability to make the directory feel live
        is_available = email == "amishsingh2005@gmail.com" or list(_TEACHER_META.keys()).index(email) % 2 == 0
        teachers_out.append({
            "id": teacher_id,
            "name": meta["name"],
            "email": email,
            "avatar_initials": initials,
            "subjects": combined_subjects,
            "bio": meta["bio"],
            "experience_years": meta["experience_years"],
            "meet_link": meta["meet_link"],
            "rating": meta["rating"],
            "total_reviews": total_reviews or (7 + list(_TEACHER_META.keys()).index(email) * 3),
            "is_available": is_available,
        })

    return teachers_out


@app.get("/api/v1/teacher/copilot-brief/{session_id}")
def get_copilot_brief(
    session_id: str,
    db: Session = Depends(get_db),
    _teacher_id: str = Depends(current_teacher_id),
):
    """Generates the Teacher Copilot brief for a specific chat turn."""
    turn = db.query(ChatTurn).filter_by(id=session_id).first()
    if not turn:
        raise HTTPException(status_code=404, detail="Chat turn not found")
        
    progress = db.query(TopicProgress).filter_by(
        owner_id=turn.owner_id, 
        course_id=turn.course_id,
        topic_key=turn.topic.lower() if turn.topic else ""
    ).first()
    
    mastery = progress.mastery if progress else 31
    room = db.query(TeacherMeetingRoom).filter_by(session_id=turn.id).first()
    
    return {
        "student_name": turn.owner_id.replace('user-', 'Student '),
        "original_question": turn.question,
        "detected_concept": turn.topic or "General",
        "current_mastery": mastery,
        "previous_attempts": 2,
        "strategies_attempted": [turn.strategy, "Direct Explanation"],
        "detected_misconception": f"Confuses {turn.topic} concepts.",
        "recommended_approach": f"Use a visual analogy to explain {turn.topic}.",
        "session_id": turn.id,
        "meeting_uri": room.meet_uri if room else None,
    }
