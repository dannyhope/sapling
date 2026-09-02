#!/usr/bin/env python3
"""Serve Sapling v2 locally with a simple polling live-reload workflow."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import sys


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1])
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
print(f"Sapling development server: http://127.0.0.1:{port}/v2/", flush=True)
server.serve_forever()
