#!/usr/bin/env python3
"""Serve the generated _site directory at /BB_FrontEnd2 for local preview."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


SITE_ROOT = Path(__file__).resolve().parent.parent / "_site"
BASE_PATH = "/BB_FrontEnd2"
DEFAULT_PORT = 4500


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        clean_path = unquote(parsed.path)

        if clean_path == "/":
            clean_path = f"{BASE_PATH}/"

        if clean_path.startswith(BASE_PATH):
            clean_path = clean_path[len(BASE_PATH):] or "/"

        relative = clean_path.lstrip("/")
        if not relative:
            relative = "index.html"

        full_path = SITE_ROOT / relative
        if full_path.is_dir():
            full_path = full_path / "index.html"
        return str(full_path)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", DEFAULT_PORT), PreviewHandler)
    print(f"Preview server running at http://127.0.0.1:{DEFAULT_PORT}{BASE_PATH}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
