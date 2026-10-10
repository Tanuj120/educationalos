import unittest

import httpx
from pydantic import ValidationError

from app.youtube import (
    YouTubeAuthenticationError,
    YouTubeConfigurationError,
    YouTubeQuotaError,
    YouTubeRecommendationRequest,
    YouTubeRecommendationService,
    YouTubeUpstreamError,
    build_search_query,
)


SEARCH_ITEM = {
    "id": {"videoId": "abc123DEF45"},
    "snippet": {
        "title": "OSPF &amp; Link State Routing",
        "channelTitle": "Network Academy",
        "description": "A visual walkthrough.",
        "publishedAt": "2025-03-02T10:00:00Z",
        "thumbnails": {"medium": {"url": "https://i.ytimg.com/vi/abc123DEF45/mqdefault.jpg"}},
    },
}


class YouTubeRecommendationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_normalizes_metadata_and_duration(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/search"):
                self.assertEqual(request.url.params["type"], "video")
                self.assertEqual(request.url.params["maxResults"], "5")
                return httpx.Response(200, json={"items": [SEARCH_ITEM]})
            return httpx.Response(200, json={"items": [{"id": "abc123DEF45", "contentDetails": {"duration": "PT12M7S"}}]})

        service = YouTubeRecommendationService("test-key", transport=httpx.MockTransport(handler))
        result = await service.recommend("How does OSPF choose the shortest path?", "OSPF")
        self.assertEqual(len(result["videos"]), 1)
        self.assertEqual(result["videos"][0]["title"], "OSPF & Link State Routing")
        self.assertEqual(result["videos"][0]["duration"], "12:07")
        self.assertEqual(result["videos"][0]["watchUrl"], "https://www.youtube.com/watch?v=abc123DEF45")

    async def test_empty_search_result_is_not_fabricated(self):
        service = YouTubeRecommendationService(
            "test-key", transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"items": []}))
        )
        result = await service.recommend("Explain subnetting")
        self.assertEqual(result["videos"], [])

    async def test_missing_key_fails_without_a_network_request(self):
        service = YouTubeRecommendationService(None)
        with self.assertRaises(YouTubeConfigurationError):
            await service.recommend("Explain routing")

    async def test_invalid_api_key_has_a_specific_error(self):
        response = {"error": {"errors": [{"reason": "keyInvalid"}]}}
        service = YouTubeRecommendationService(
            "bad-key", transport=httpx.MockTransport(lambda request: httpx.Response(400, json=response))
        )
        with self.assertRaises(YouTubeAuthenticationError):
            await service.recommend("Explain routing")

    async def test_quota_exhaustion_has_a_specific_error(self):
        response = {"error": {"errors": [{"reason": "quotaExceeded"}]}}
        service = YouTubeRecommendationService(
            "test-key", transport=httpx.MockTransport(lambda request: httpx.Response(403, json=response))
        )
        with self.assertRaises(YouTubeQuotaError):
            await service.recommend("Explain routing")

    async def test_network_timeout_is_graceful(self):
        def timeout(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("timed out", request=request)

        service = YouTubeRecommendationService("test-key", transport=httpx.MockTransport(timeout))
        with self.assertRaisesRegex(YouTubeUpstreamError, "too long"):
            await service.recommend("Explain routing")

    async def test_successful_results_are_cached_by_normalized_query(self):
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            if request.url.path.endswith("/search"):
                return httpx.Response(200, json={"items": [SEARCH_ITEM]})
            return httpx.Response(200, json={"items": []})

        service = YouTubeRecommendationService("test-key", transport=httpx.MockTransport(handler))
        first = await service.recommend("Explain OSPF", "OSPF")
        second = await service.recommend("  Explain   OSPF  ", "OSPF")
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertEqual(calls, 2)

    def test_request_validation_and_query_length(self):
        with self.assertRaises(ValidationError):
            YouTubeRecommendationRequest(question="")
        query = build_search_query("word " * 100, "Routing")
        self.assertLessEqual(len(query), 180)
        self.assertIn("tutorial explanation", query)


if __name__ == "__main__":
    unittest.main()
