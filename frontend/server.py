"""Frontend dev server.

Serves the static frontend and proxies /api/* to the FastAPI backend so the
browser stays same-origin (the backend sends no CORS headers, and the backend
folder must not be modified).

Usage:
    python server.py            # http://localhost:5173
    python server.py 3000       # custom port
"""
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BACKEND = "http://127.0.0.1:8000"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keep-alive; every response we send includes Content-Length.
    # (Default HTTP/1.0 makes Chrome occasionally hit ERR_EMPTY_RESPONSE on
    # reused connections.)
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            self.proxy()
        else:
            self.send_error(404)

    def proxy(self):
        target = BACKEND + self.path[len("/api"):]
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(
            target,
            data=body,
            method=self.command,
            headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                self.relay(resp.status, resp.headers.get("Content-Type"), resp.read())
        except urllib.error.HTTPError as e:
            self.relay(e.code, e.headers.get("Content-Type"), e.read())
        except Exception as e:
            self.relay(502, "application/json",
                       b'{"error": "Backend unreachable at ' + BACKEND.encode() + b'"}')
            print(f"[proxy] {self.command} {target} failed: {e}")

    def relay(self, status, content_type, data):
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"Frontend  → http://localhost:{PORT}")
    print(f"API proxy → /api/* → {BACKEND}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
