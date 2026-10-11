"""The server must accept exercise state beyond the former 16 MiB ceiling."""
import importlib.util
import io
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('foulee_server', Path(__file__).resolve().parents[1] / 'serve_local.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class LargeRequestTests(unittest.TestCase):
    def test_accepts_body_over_former_limit(self):
        body = b'{"value":"' + b'x' * (17 * 1024 * 1024) + b'"}'
        handler = object.__new__(server.Handler)
        handler.headers = {'Content-Length': str(len(body))}
        handler.rfile = io.BytesIO(body)
        self.assertEqual(len(handler.read_json()['value']), 17 * 1024 * 1024)

    def test_rejects_invalid_negative_content_length(self):
        handler = object.__new__(server.Handler)
        handler.headers = {'Content-Length': '-1'}
        handler.rfile = io.BytesIO(b'{}')
        with self.assertRaises(ValueError):
            handler.read_json()

if __name__ == '__main__':
    unittest.main()
