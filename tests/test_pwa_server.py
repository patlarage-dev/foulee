"""Exercise public PWA routes without touching the user's database."""
import importlib.util
import threading
import unittest
import http.client
from pathlib import Path
spec = importlib.util.spec_from_file_location('foulee_server', Path(__file__).resolve().parents[1] / 'serve_local.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass

class PwaRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown(); cls.httpd.server_close(); cls.thread.join()

    def request(self, method, path):
        conn = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port)
        conn.request(method, path)
        response = conn.getresponse()
        result = (response.status, {k.lower(): v for k, v in response.getheaders()}, response.read())
        conn.close()
        return result

    def test_public_assets_get_head_and_revalidation(self):
        for path in sorted(server.PUBLIC_FILES):
            for method in ('GET', 'HEAD'):
                with self.subTest(path=path, method=method):
                    status, headers, body = self.request(method, path)
                    self.assertEqual(status, 200)
                    self.assertEqual(headers['cache-control'], 'no-cache')
                    if method == 'HEAD': self.assertEqual(body, b'')
        _, headers, _ = self.request('GET', '/manifest.webmanifest')
        self.assertEqual(headers['content-type'], 'application/manifest+json')
        _, headers, _ = self.request('GET', '/sw.js')
        self.assertIn('javascript', headers['content-type'])

    def test_private_paths_remain_protected(self):
        self.assertEqual(self.request('GET', '/README.md')[0], 404)
        self.assertEqual(self.request('GET', '/icons/../serve_local.py')[0], 404)
        self.assertEqual(self.request('GET', '/api/state')[0], 401)

if __name__ == '__main__': unittest.main()
