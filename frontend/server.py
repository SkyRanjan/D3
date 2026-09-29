"""Frontend dev server.

Serves the static frontend and proxies API calls so the browser stays
same-origin (neither service sends CORS headers, and the backend folder must
not be modified):

    /api/tts/*  -> TTS service   (http://127.0.0.1:8001/tts/*)
    /api/*      -> chat backend  (http://127.0.0.1:8000/*)

Streaming responses (TTS NDJSON) are relayed chunk by chunk, not buffered.

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
TTS = "http://127.0.0.1:8001"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(SimpleHTTPRequestHandler):
    # HTTP/1.1 keep-alive; every response carries Content-Length or chunked
    # framing. (HTTP/1.0 made Chrome hit ERR_EMPTY_RESPONSE on reused sockets.)
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
        path = self.path[len("/api"):]
        upstream = TTS if path.startswith("/tts") else BACKEND
        target = upstream + path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(
            target,
            data=body,
            method=self.command,
            headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
        )
        try:
            resp = urllib.request.urlopen(req, timeout=300)
        except urllib.error.HTTPError as e:
            self.relay(e.code, e.headers.get("Content-Type"), e.read())
            return
        except Exception as e:
            name = "TTS service" if upstream == TTS else "Backend"
            self.relay(502, "application/json",
                       f'{{"error": "{name} unreachable at {upstream}"}}'.encode())
            print(f"[proxy] {self.command} {target} failed: {e}")
            return

        with resp:
            ctype = resp.headers.get("Content-Type", "")
            if "ndjson" in ctype or "event-stream" in ctype:
                self.stream(resp.status, ctype, resp)
            else:
                self.relay(resp.status, ctype, resp.read())

    def relay(self, status, content_type, data):
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def stream(self, status, content_type, resp):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        try:
            while True:
                data = resp.read1(65536)
                if not data:
                    break
                self.wfile.write(b"%x\r\n%s\r\n" % (len(data), data))
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            # Browser aborted (user pressed Stop / new utterance); closing the
            # upstream socket lets the TTS service notice the disconnect.
            self.close_connection = True

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"Frontend  → http://localhost:{PORT}")
    print(f"API proxy → /api/tts/* → {TTS}   /api/* → {BACKEND}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
