import io
import tempfile
import unittest
from pathlib import Path

import fitz
from fastapi import HTTPException, UploadFile

from app.main import (
    detect_book_sections,
    learner_twin_display_mastery,
    save_upload_with_limit,
    strongest_topic_for_display,
    validated_identity,
)


class RoleProtectionTests(unittest.TestCase):
    def test_accepts_matching_student_and_teacher_identities(self):
        self.assertEqual(validated_identity("user-alex@example.com", "student"), ("user-alex@example.com", "student"))
        self.assertEqual(validated_identity("teacher-priya@example.com", "teacher"), ("teacher-priya@example.com", "teacher"))

    def test_rejects_missing_or_mismatched_roles(self):
        with self.assertRaises(HTTPException) as missing:
            validated_identity(None, None)
        self.assertEqual(missing.exception.status_code, 401)

        with self.assertRaises(HTTPException) as mismatched:
            validated_identity("user-alex@example.com", "teacher")
        self.assertEqual(mismatched.exception.status_code, 403)


class UploadLimitTests(unittest.IsolatedAsyncioTestCase):
    async def test_streams_an_upload_within_the_limit(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / "sample.pdf"
            payload = b"%PDF-1.7\nsmall test"
            upload = UploadFile(filename="sample.pdf", file=io.BytesIO(payload))
            stored = await save_upload_with_limit(upload, destination, 1024)
            self.assertEqual(stored, len(payload))
            self.assertEqual(destination.read_bytes(), payload)

    async def test_rejects_and_removes_an_oversized_upload(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / "large.pdf"
            upload = UploadFile(filename="large.pdf", file=io.BytesIO(b"%PDF-" + b"x" * 128))
            with self.assertRaises(HTTPException) as oversized:
                await save_upload_with_limit(upload, destination, 32)
            self.assertEqual(oversized.exception.status_code, 413)
            self.assertFalse(destination.exists())


class BookSectionDetectionTests(unittest.TestCase):
    def test_prefers_the_pdf_outline_for_real_chapter_boundaries(self):
        document = fitz.open()
        try:
            for number in range(6):
                page = document.new_page()
                page.insert_text((72, 72), f"Page {number + 1}")
            document.set_toc([[1, "Foundations", 1], [1, "Routing", 3], [1, "Security", 5]])
            sections, method = detect_book_sections(document)
            self.assertEqual(method, "PDF_OUTLINE")
            self.assertEqual([item["title"] for item in sections], ["Foundations", "Routing", "Security"])
            self.assertEqual([(item["start_page"], item["end_page"]) for item in sections], [(0, 1), (2, 3), (4, 5)])
        finally:
            document.close()

    def test_falls_back_to_bounded_page_groups_without_using_watermarks_as_titles(self):
        document = fitz.open()
        try:
            for _ in range(51):
                page = document.new_page()
                page.insert_text((72, 72), "Scanned by CamScanner", fontsize=18)
            sections, method = detect_book_sections(document)
            self.assertEqual(method, "PAGE_GROUPS")
            self.assertEqual(len(sections), 3)
            self.assertTrue(all(item["title"].startswith("Part ") for item in sections))
        finally:
            document.close()


class LearnerTwinPresentationTests(unittest.TestCase):
    def test_evidence_backed_mastery_never_displays_as_zero(self):
        self.assertEqual(learner_twin_display_mastery(0, 5), 25)
        self.assertEqual(learner_twin_display_mastery(82, 5), 82)
        self.assertEqual(learner_twin_display_mastery(0, 0), 0)

    def test_strongest_topic_is_named_and_distinct_from_focus_when_possible(self):
        focus = {"topic": "Subnetting", "mastery": 25, "signals": 8, "correct": 0, "incorrect": 8, "confused": 0}
        automata = {"topic": "Automata", "mastery": 42, "signals": 3, "correct": 1, "incorrect": 2, "confused": 0}
        strongest = strongest_topic_for_display([focus, automata], focus)
        self.assertEqual(strongest["topic"], "Automata")


if __name__ == "__main__":
    unittest.main()
