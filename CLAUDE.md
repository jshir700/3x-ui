# 3x-ui Development Guide

## Project Overview

3x-ui is an Xray panel with a Go backend (Gin framework) and a Vue 3 frontend (Vite + Ant Design Vue). The subscription module serves proxy configurations at `/sub/{subId}` URLs.

## Build Methods

### 1. Local build (default for dev iteration) — PowerShell script

```powershell
.\build.ps1
```

Runs the full pipeline:
1. Syncs frontend source to `C:\x3ui-frontend` (avoids CJK-path npm issues)
2. Syncs translations to `C:\web\translation` (referenced via `../../../web/translation/` from frontend)
3. `npm run build` on `C:\x3ui-frontend` → outputs to `C:\web\dist\`
4. Copies `C:\web\dist\` back to project `web/dist/`
5. `go build -ldflags "-w -s" -o x-ui.exe .` from project root

Requires PATH configured as:
- `C:\x3ui-frontend\gcc-shim` (strips `-Wdeclaration-after-statement` — GCC 16 removed it but Go 1.26 cgo still hardcodes it)
- `D:\Software\Fixed\Code\base\msys64\ucrt64\bin` (GCC 16 for CGO/SQLite)
- `D:\Software\Fixed\Code\base\Go\bin` (Go 1.26)

The resulting `x-ui.exe` is a Windows PE binary for **compilation verification only** — the app is Linux-native and must be run in Docker.

### 2. Docker build — for running/testing

```powershell
docker compose up -d --build
```

This runs the multi-stage Dockerfile:
1. **Frontend** — `node:24-alpine`, runs `npm ci` then `npm run build`, outputs to `web/dist/`
2. **Builder** — `golang:1.26-alpine`, compiles `main.go` → `x-ui` binary, copies frontend dist
3. **Runtime** — `alpine`, runs fail2ban + x-ui on port 2053

The panel is accessible at `http://localhost:2053`.

### 3. Production install (`install.sh`) — downloads pre-compiled binaries

```bash
bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)
```

This **never compiles from source**. It downloads pre-built binaries from GitHub Releases.

## Testing

### Test data setup

Before manual testing, pre-populate the panel with realistic data so every page has content to render:

```powershell
.\setup-test-data.ps1
```

This creates via the panel API:
- **50 inbounds** — vmess/vless/trojan/shadowsocks/wireguard/hysteria/mixed/http/tunnel/tun × 5 each, multiple clients per inbound
- **20 nodes** — varied schemes, addresses, ports, heartbeat statuses
- **20 subscriptions** — linking inbounds, 5 per format (base64, text, clash, json), titles, support URLs

Traffic values (up/down/total/quota) are set to realistic non-zero values — not all 0 or ∞ — so the UI renders progress bars, usage stats, and expiry times correctly. Auto-generated UUIDs, passwords, and subIds per inbound/client.

### Automated verification (run after every build)

After `.\build.ps1` succeeds and Docker is running:

1. Curl-verify authenticated panel pages return HTTP 200:
   - `http://localhost:2053/panel/inbounds`
   - `http://localhost:2053/panel/settings`
   - `http://localhost:2053/panel/subscription`
   - `http://localhost:2053/panel/xray`
   - `http://localhost:2053/panel/nodes`
2. Curl-verify subscription pages on port **2096** (not 2053):
   - `http://localhost:2096/sub/{subId}` → raw config
   - `http://localhost:2096/sub/{subId}?html=1` → SPA page
3. Check `?html=1` response contains `window.__SUB_PAGE_DATA__` with expected fields

### Post-verification Docker cleanup

After tests pass and the user confirms manual verification is done, clean up Docker caches so the VHDX doesn't bloat unnecessarily:

```bash
docker builder prune --force
docker image prune --force
```

This reclaims space *inside* the VHDX. The VHDX file itself won't shrink on disk — that requires a separate periodic `diskpart compact` (shut down Docker + WSL first), which is done on an as-needed basis, not every test cycle.

### Manual verification (user checks in browser)

After automated tests pass, **provide the user with clickable test URLs** and credentials. Do NOT clean up test data until the user confirms they've verified in browser.

### Test data cleanup

After the user confirms manual verification:
- Delete any test subscriptions/inbounds created via API for testing
- Delete any temporary files (test*.c, gcc-wrap.*, etc.) in `C:\x3ui-frontend\`
- Keep: `gcc-shim\gcc.exe`, `node_modules\`, project `x-ui.exe`

### Test with curl (non-browser, non-HTML)

```bash
curl http://localhost:2053/sub/{subId}
# Returns base64/text/clash/json content

curl "http://localhost:2053/sub/{subId}?html=1"
# Forces HTML/SPA page even without Accept header
```

## Key Files

| File | Purpose |
|---|---|
| `sub/subController.go` | HTTP handler: `tryAggregateSub`, `serveSubPage`, `subs` |
| `sub/subService.go` | Business logic: `PageData` struct, `BuildPageData`, `GetSubs` |
| `frontend/src/pages/sub/SubPage.vue` | Vue SFC for subscription info page |
| `web/translation/*.json` (x13) | i18n flat keys (vue-i18n `legacy: false`) |
| `build.ps1` | Local build script |

## i18n

- Flat key format in `web/translation/`, all 13 languages
- New keys: `subTrafficUsage`, `subRemained`, `subSupportLink`, `subProfileLink`
- Existing keys reused: `subCopyLink`, `subAnnounce`, `subUpdateInterval`
- Nested `subscription.*` keys exist for page-specific labels

## Post-Build Cleanup

**Every time** after running tests, debugging cgo/GCC, or any ad-hoc validation that creates temporary files, check both `C:\x3ui-frontend\` and the project root for leftover artifacts:

| Pattern | Source | Action |
|---|---|---|
| `test*.c`, `test*.o`, `test*.exe` | cgo/GCC ad-hoc tests | Delete |
| `gcc-wrap.go`, `gcc-wrap.exe`, `gcc-wrap.bat` | GCC shim debugging | Delete |
| `*.tmp`, `*.log`, `*-debug-*` | general debugging | Delete |

**Safe to keep:**
- `C:\x3ui-frontend\gcc-shim\gcc.exe` — permanent shim, required for cgo builds
- `C:\x3ui-frontend\node_modules\` — npm dependencies
- `x-ui.exe` in project root — the build output

Run this check automatically after any debugging session — don't wait for the user to ask.

## Known Environment Constraints

- File paths with CJK characters and spaces (e.g., `我的云端硬盘`) — always quote in shell commands
- npm cannot work on CJK paths → frontend build must run from `C:\x3ui-frontend` (real directory, ASCII path)
- GCC 16 dropped `-Wdeclaration-after-statement` → Go 1.26 cgo needs the `gcc-shim` wrapper to strip it
- The locally-built `x-ui.exe` is compile-check only; running/testing requires Docker (Linux runtime)
