"""Official YouTube Data API integration for optional learning recommendations."""
from __future__ import annotations

import asyncio
import html
import re
import time
from collections import OrderedDict
from typing import Any

import httpx
from pydantic import BaseModel, Field


YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3"
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{6,20}$")


class YouTubeRecommendationRequest(BaseModel):
    question: str = Field(min_length=1, max_length=6000)
    topic: str | None = Field(default=None, max_length=120)
    responseId: str | None = Field(default=None, min_length=1, max_length=64)


class YouTubeServiceError(Exception):
    """Base class for errors safe to translate at the API boundary."""


class YouTubeConfigurationError(YouTubeServiceError):
    pass


class YouTubeAuthenticationError(YouTubeServiceError):
    pass


class YouTubeQuotaError(YouTubeServiceError):
    pass


class YouTubeRateLimitError(YouTubeServiceError):
    pass


class YouTubeUpstreamError(YouTubeServiceError):
    pass


def build_search_query(question: str, topic: str | None = None) -> str:
    """Create a concise educational query without sending the full answer/history."""
    cleaned_question = re.sub(r"\s+", " ", question).strip(" \t\r\n?.!")
    cleaned_topic = re.sub(r"\s+", " ", topic or "").strip(" \t\r\n?.!")
    question_words = cleaned_question.split()[:18]
    parts: list[str] = []
    if cleaned_topic and cleaned_topic.casefold() not in cleaned_question.casefold():
        parts.append(cleaned_topic)
    parts.append(" ".join(question_words))
    parts.append("tutorial explanation")
    return " ".join(part for part in parts if part).strip()[:180]


def format_youtube_duration(value: str | None) -> str | None:
    """Turn YouTube's ISO-8601 duration into a compact clock value."""
    if not value:
        return None
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", value)
    if not match:
        return None
    hours, minutes, seconds = (int(part or 0) for part in match.groups())
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def _youtube_error_reason(response: httpx.Response) -> str:
    try:
        errors = response.json().get("error", {}).get("errors", [])
        return str(errors[0].get("reason", "")) if errors else ""
    except (TypeError, ValueError, AttributeError):
        return ""


class YouTubeRecommendationService:
    def __init__(
        self,
        api_key: str | None,
        *,
        cache_ttl_seconds: int = 900,
        cache_size: int = 128,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.api_key = (api_key or "").strip()
        self.cache_ttl_seconds = max(0, cache_ttl_seconds)
        self.cache_size = max(1, cache_size)
        self.timeout_seconds = timeout_seconds
        self.transport = transport
        self._cache: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
        self._cache_lock = asyncio.Lock()

    async def recommend(self, question: str, topic: str | None = None) -> dict[str, Any]:
        if not self.api_key:
            raise YouTubeConfigurationError("YouTube recommendations are not configured.")

        query = build_search_query(question, topic)
        cache_key = query.casefold()
        cached = await self._get_cached(cache_key)
        if cached is not None:
            return {**cached, "cached": True}

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout_seconds), transport=self.transport
            ) as client:
                search_response = await client.get(
                    f"{YOUTUBE_API_ROOT}/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": 5,
                        "order": "relevance",
                        "videoEmbeddable": "true",
                        "safeSearch": "moderate",
                        "key": self.api_key,
                    },
                )
                self._raise_for_response(search_response)
                search_items = search_response.json().get("items", [])
                ids = [
                    str(item.get("id", {}).get("videoId", ""))
                    for item in search_items
                    if VIDEO_ID_PATTERN.fullmatch(str(item.get("id", {}).get("videoId", "")))
                ]
                durations = await self._fetch_durations(client, ids) if ids else {}
        except httpx.TimeoutException as error:
            raise YouTubeUpstreamError("YouTube took too long to respond. Please try again.") from error
        except httpx.RequestError as error:
            raise YouTubeUpstreamError("YouTube is temporarily unreachable. Please try again.") from error
        except (TypeError, ValueError, AttributeError) as error:
            raise YouTubeUpstreamError("YouTube returned an unexpected response.") from error

        videos = []
        for item in search_items:
            snippet = item.get("snippet", {})
            video_id = str(item.get("id", {}).get("videoId", ""))
            if not VIDEO_ID_PATTERN.fullmatch(video_id):
                continue
            thumbnails = snippet.get("thumbnails", {})
            thumbnail = thumbnails.get("medium") or thumbnails.get("high") or thumbnails.get("default") or {}
            videos.append({
                "videoId": video_id,
                "title": html.unescape(str(snippet.get("title", ""))).strip(),
                "channelTitle": html.unescape(str(snippet.get("channelTitle", ""))).strip(),
                "thumbnailUrl": str(thumbnail.get("url", "")),
                "description": html.unescape(str(snippet.get("description", ""))).strip(),
                "publishedAt": str(snippet.get("publishedAt", "")),
                "duration": durations.get(video_id),
                "watchUrl": f"https://www.youtube.com/watch?v={video_id}",
            })

        result = {"query": query, "videos": videos, "cached": False}
        await self._set_cached(cache_key, result)
        return result

    async def _fetch_durations(self, client: httpx.AsyncClient, video_ids: list[str]) -> dict[str, str]:
        response = await client.get(
            f"{YOUTUBE_API_ROOT}/videos",
            params={"part": "contentDetails", "id": ",".join(video_ids), "key": self.api_key},
        )
        self._raise_for_response(response)
        durations: dict[str, str] = {}
        for item in response.json().get("items", []):
            video_id = str(item.get("id", ""))
            duration = format_youtube_duration(item.get("contentDetails", {}).get("duration"))
            if VIDEO_ID_PATTERN.fullmatch(video_id) and duration:
                durations[video_id] = duration
        return durations

    @staticmethod
    def _raise_for_response(response: httpx.Response) -> None:
        if response.is_success:
            return
        reason = _youtube_error_reason(response)
        if reason in {"quotaExceeded", "dailyLimitExceeded"}:
            raise YouTubeQuotaError("YouTube's recommendation quota is currently exhausted.")
        if reason in {"keyInvalid", "accessNotConfigured", "ipRefererBlocked"}:
            raise YouTubeAuthenticationError("The YouTube API credentials are invalid or restricted.")
        if response.status_code == 429 or reason in {"rateLimitExceeded", "userRateLimitExceeded"}:
            raise YouTubeRateLimitError("Too many YouTube requests. Please wait and try again.")
        raise YouTubeUpstreamError("YouTube could not provide recommendations right now.")

    async def _get_cached(self, key: str) -> dict[str, Any] | None:
        async with self._cache_lock:
            cached = self._cache.get(key)
            if cached is None:
                return None
            created_at, value = cached
            if time.monotonic() - created_at > self.cache_ttl_seconds:
                self._cache.pop(key, None)
                return None
            self._cache.move_to_end(key)
            return {**value, "videos": [dict(video) for video in value["videos"]]}

    async def _set_cached(self, key: str, value: dict[str, Any]) -> None:
        async with self._cache_lock:
            self._cache[key] = (time.monotonic(), value)
            self._cache.move_to_end(key)
            while len(self._cache) > self.cache_size:
                self._cache.popitem(last=False)
