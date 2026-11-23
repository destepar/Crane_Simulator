import http.server
import socketserver
import webbrowser
import time
import sys
import os

args = [a for a in sys.argv[1:] if not a.startswith('--')]
flags = {a for a in sys.argv[1:] if a.startswith('--')}

PORT = int(args[0]) if len(args) > 0 else 8888
OPEN_BROWSER = ('--no-browser' not in flags) and (os.environ.get('NO_BROWSER') != '1')

# Asegurar que servimos desde la raíz del proyecto
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(PROJECT_ROOT)

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True

for p in [PORT, 8889, 8000, 8080]:
    try:
        with socketserver.ThreadingTCPServer(("127.0.0.1", p), NoCacheHTTPRequestHandler) as httpd:
            url = f"http://127.0.0.1:{p}/index.html"
            print(f"====================================================================", flush=True)
            print(f"  SERVIDOR ACTIVO (SIN CACHE): {url}", flush=True)
            print(f"  Modo navegador externo: {'ACTIVO' if OPEN_BROWSER else 'DESACTIVADO (INTEGRADO)'}", flush=True)
            print(f"  Directorio raiz: {PROJECT_ROOT}", flush=True)
            print(f"====================================================================", flush=True)
            if OPEN_BROWSER:
                webbrowser.open(f"{url}?v={int(time.time())}")
            httpd.serve_forever()
            break
    except OSError:
        print(f"[AVISO] Puerto {p} en uso, probando siguiente puerto...", flush=True)
