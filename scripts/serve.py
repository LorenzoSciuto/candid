#!/usr/bin/env python3
"""Custom static file server with a job-themed 404 page."""
import ssl
import sys
import http.server

NOT_FOUND_HTML = b"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>404 \xe2\x80\x94 Position Not Found \xc2\xb7 Candid</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f8f8f6;
    --surface: #ffffff;
    --border: #e4e3df;
    --ink: #1a1a18;
    --ink-secondary: #5a5a55;
    --ink-muted: #9b9b95;
    --danger: #d94040;
    --positive: #1d8a4e;
    --mono: "JetBrains Mono", "Fira Code", monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111110;
      --surface: #1c1c1a;
      --border: #2e2e2a;
      --ink: #e8e8e2;
      --ink-secondary: #9a9a92;
      --ink-muted: #5c5c56;
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0 20px 60px;
  }
  .wrap { max-width: 540px; width: 100%; }
  .ghost {
    font-family: var(--mono);
    font-size: 22vw;
    font-weight: 700;
    letter-spacing: -0.06em;
    line-height: 0.88;
    color: var(--ink);
    opacity: 0.06;
    user-select: none;
    text-align: center;
    width: 100%;
    margin-bottom: 32px;
    padding-top: 40px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 28px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04);
  }
  .stamp {
    position: absolute;
    top: 18px; right: 20px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--danger);
    border: 2px solid var(--danger);
    border-radius: 3px;
    padding: 3px 7px;
    opacity: 0.7;
    transform: rotate(1.5deg);
  }
  .logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .logo-box {
    width: 38px; height: 38px; border-radius: 9px;
    background: var(--bg); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .logo-box svg { opacity: 0.55; }
  .org-name { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted); font-weight: 600; }
  .org-sub { font-size: 12px; color: var(--ink-secondary); margin-top: 2px; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 8px; }
  p { font-size: 14px; color: var(--ink-secondary); line-height: 1.65; margin-bottom: 22px; }
  .meta {
    display: flex; gap: 0; flex-wrap: wrap;
    border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    margin-bottom: 22px;
  }
  .meta-item { padding: 12px 20px 12px 0; min-width: 110px; }
  .meta-label { font-size: 10.5px; color: var(--ink-muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta-val { font-size: 13px; font-weight: 500; }
  .status-row { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .status-label { font-size: 12px; color: var(--ink-muted); }
  .pill {
    font-size: 11.5px; font-weight: 600; padding: 3px 11px; border-radius: 20px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
    border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .btn-primary {
    padding: 9px 22px; border-radius: 8px; font-size: 13.5px; font-weight: 600;
    background: var(--ink); color: var(--bg); border: none; cursor: pointer;
    letter-spacing: -0.01em; text-decoration: none; display: inline-block;
    transition: opacity .15s;
  }
  .btn-primary:hover { opacity: 0.82; }
  .hint { margin-top: 18px; font-size: 12px; color: var(--ink-muted); text-align: center; }
  .req-path {
    font-family: var(--mono); font-size: 11px; color: var(--ink-muted);
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 5px; padding: 2px 7px; display: inline-block; margin-top: 4px;
  }
</style>
</head>
<body>
<div class="ghost">404</div>
<div class="wrap">
  <div class="card">
    <div class="stamp">Position Closed</div>

    <div class="logo-row">
      <div class="logo-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
          <line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
      </div>
      <div>
        <div class="org-name">Candid &middot; Recruiting</div>
        <div class="org-sub">Static file server</div>
      </div>
    </div>

    <h1>This Page Didn't Make It Past Screening</h1>
    <p>
      The file you requested was not found on this server.
      It may have been moved, deleted, or the URL contains a typo.
      <br/>
      <span class="req-path" id="req-path"></span>
    </p>

    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Error Code</div>
        <div class="meta-val">&#128274; 404</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Openings</div>
        <div class="meta-val">0</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Location</div>
        <div class="meta-val">&#127758; Nowhere</div>
      </div>
    </div>

    <div class="status-row">
      <span class="status-label">Application status:</span>
      <span class="pill">Rejected at File Lookup</span>
    </div>

    <div class="actions">
      <a class="btn-primary" href="/">Back to App</a>
    </div>
  </div>
  <p class="hint">If you think this is a bug, check the URL or contact your workspace admin.</p>
</div>
<script>
  const p = document.getElementById("req-path");
  if (p) p.textContent = window.location.pathname;
</script>
</body>
</html>"""


class CandidHandler(http.server.SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        if code == 404:
            body = NOT_FOUND_HTML
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        pass  # silence request noise


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    cert = sys.argv[2] if len(sys.argv) > 2 else None
    key  = sys.argv[3] if len(sys.argv) > 3 else None

    server = http.server.HTTPServer(("", port), CandidHandler)

    if cert and key:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    else:
        scheme = "http"

    print(f"→  Candid frontend → {scheme}://localhost:{port}/")
    if scheme == "http":
        print("   Tip: run ./scripts/gen-certs.sh to enable HTTPS")
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
