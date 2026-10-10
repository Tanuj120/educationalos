import io
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.main import save_upload_with_limit, validated_identity


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


if __name__ == "__main__":
    unittest.main()
