#!/usr/bin/env bash
# 実機(スマホ)テスト用: ビルド済み dist を Cloudflare クイックトンネルで一時公開する。
# 本物の証明書の https URL が出るので、getUserMedia(マイク)が必要なモバイルでもそのまま動く。
# 静的なデモアプリのみ(秘密情報なし)だが、URL を知る誰でも一時的にアクセスできる点に注意。
#
# 使い方:
#   pnpm build && bash scripts/serve-tunnel.sh [port=4173]
#
# 複数台のスマホで同じ URL を開き、各自 3 文字名を入力してマイクを許可 → 端末間で FT8 交信を試す。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-4173}"
CF="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"

[ -x "$CF" ] || {
  echo "cloudflared が見つかりません: https://github.com/cloudflare/cloudflared" >&2
  exit 1
}
[ -d "$ROOT/dist" ] || {
  echo "dist がありません。先に 'pnpm build' を実行してください。" >&2
  exit 1
}

# WASM を正しい MIME で返すため簡易サーバに拡張子マップを渡す(python http.server はデフォルトで octet-stream)。
python3 -c "
import http.server, functools, sys
http.server.SimpleHTTPRequestHandler.extensions_map['.wasm'] = 'application/wasm'
http.server.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory='$ROOT/dist')
http.server.ThreadingHTTPServer(('127.0.0.1', $PORT), handler).serve_forever()
" &
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT

echo "serving dist on http://localhost:$PORT — opening Cloudflare quick tunnel…"
"$CF" tunnel --url "http://localhost:$PORT"
