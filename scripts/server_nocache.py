import http.server
import socketserver
import webbrowser
import time
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888

# Asegurar que servimos desde la raíz del proyecto
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(PROJECT_ROOT)

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True

for p in [PORT, 8889, 8000, 8080]:
    try:
        with socketserver.ThreadingTCPServer(("", p), NoCacheHTTPRequestHandler) as httpd:
            url = f"http://localhost:{p}/index.html?v={int(time.time())}"
            print(f"====================================================================")
            print(f"  SERVIDOR ACTIVO (SIN CACHE): {url}")
            print(f"  Directorio raiz: {PROJECT_ROOT}")
            print(f"====================================================================")
            webbrowser.open(url)
            httpd.serve_forever()
            break
    except OSError:
        print(f"[AVISO] Puerto {p} en uso, probando siguiente puerto...")
