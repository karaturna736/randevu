"""Exercise the production proxy locations against a loopback echo server.

Requires nginx; no production server or database is contacted.
NETA_NGINX_CONFIG can select a pre-fix config to reproduce the spoofing bug.
"""
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

nginx = os.environ.get("NGINX_BIN") or shutil.which("nginx")
if not nginx:
    raise SystemExit("nginx is required for the proxy integration test")
source = Path(os.environ.get("NETA_NGINX_CONFIG", "deploy/nginx-netarandevu.conf")).read_text()
locations = []
for match in re.finditer(r"location\s+(= /api/v1/events|/api/|/)\s*\{([^{}]*)\}", source):
    if "proxy_pass http://neta_app;" in match[2]:
        locations.append((match[1], match[2]))
assert len(locations) == 3, "All production proxy locations must be exercised"


class Echo(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"ip": self.headers.get("CF-Connecting-IP"), "real": self.headers.get("X-Real-IP")}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


backend = ThreadingHTTPServer(("127.0.0.1", 0), Echo)
thread = threading.Thread(target=backend.serve_forever, daemon=True)
thread.start()
with socket.socket() as probe:
    probe.bind(("127.0.0.1", 0))
    port = probe.getsockname()[1]

try:
    with tempfile.TemporaryDirectory(prefix="neta-proxy-test-") as directory:
        target = f"http://127.0.0.1:{backend.server_port}"
        blocks = "\n".join("location " + name + " {" + body.replace("http://neta_app", target) + "}" for name, body in locations)
        config = Path(directory, "nginx.conf")
        # A container running as root may not permit switching to nobody.
        # This isolated single-process test stays under its invoking identity.
        user_directive = "user root;" if os.geteuid() == 0 else ""
        config.write_text(f"""
{user_directive}
pid {directory}/nginx.pid;
error_log {directory}/error.log;
events {{ worker_connections 64; }}
http {{
  access_log off;
  client_body_temp_path {directory}/body;
  proxy_temp_path {directory}/proxy;
  fastcgi_temp_path {directory}/fastcgi;
  uwsgi_temp_path {directory}/uwsgi;
  scgi_temp_path {directory}/scgi;
  limit_req_zone $binary_remote_addr zone=neta_api:10m rate=20r/s;
  server {{ listen 127.0.0.1:{port}; {blocks} }}
}}
""")
        process = subprocess.Popen([nginx, "-p", directory + "/", "-c", str(config), "-g", "daemon off; master_process off;"], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 5
            while True:
                if process.poll() is not None:
                    raise AssertionError(process.stderr.read().decode())
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                        break
                except OSError:
                    if time.monotonic() > deadline:
                        raise AssertionError("Nginx did not start")
                    time.sleep(0.05)
            checks = 0
            for path in ["/panel", "/api/v1/auth-status", "/api/v1/events"]:
                for forged in ["192.0.2.10", "198.51.100.20", "127.0.0.2", "garbage", None]:
                    headers = {"X-Real-IP": "203.0.113.10", "X-Forwarded-For": "203.0.113.11"}
                    if forged is not None:
                        headers["CF-Connecting-IP"] = forged
                    with urlopen(Request(f"http://127.0.0.1:{port}{path}", headers=headers), timeout=3) as response:
                        echoed = json.load(response)
                    assert echoed["ip"] == "127.0.0.1", f"{path}: untrusted IP reached backend: {echoed['ip']!r}"
                    assert echoed["real"] == "127.0.0.1"
                    checks += 1
            print(json.dumps({"passed": checks, "failed": 0}))
        finally:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            process.stderr.close()
finally:
    backend.shutdown()
    backend.server_close()
    thread.join()
