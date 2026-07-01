#!/usr/bin/env bash
# ft8_lib(Karlis Goba, MIT)を Emscripten で WASM 化し、src/audio/wasm/ へ配置する。
# encode(テキスト→音声)と decode(音声→テキスト+周波数)の両方をエクスポートする。
# emcc をローカルに入れず Docker の emscripten/emsdk イメージでビルドする。
#
# 使い方:
#   bash scripts/build-ft8-wasm.sh
#
# 前提: docker が動作していること。ft8_lib は MIT のため取得のみ(このリポジトリには含めない)。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1) ft8_lib を取得(MIT。git 管理外)
git clone --depth 1 https://github.com/kgoba/ft8_lib.git "$WORK/ft8_lib"

# 2) エンコード/デコードの C シム(このリポジトリで管理)を配置
mkdir -p "$WORK/shims" "$WORK/dist"
cp "$ROOT/src/audio/wasm/encode_samples.c" "$ROOT/src/audio/wasm/decode_samples.c" "$WORK/shims/"

# 3) Docker の emscripten で両シムをリンクしてビルド
docker run --rm -v "$WORK":/work -w /work emscripten/emsdk bash -c '
emcc -O2 -DHAVE_STPCPY -I ft8_lib \
  ft8_lib/ft8/*.c ft8_lib/common/monitor.c ft8_lib/fft/*.c \
  shims/decode_samples.c shims/encode_samples.c \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createFt8 -sENVIRONMENT=web,worker,node \
  -sEXPORTED_FUNCTIONS=_ft8_decode_samples,_ft8_encode_samples,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,HEAPF32,HEAPU8 \
  -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=8MB \
  -o dist/ft8.mjs'

# 4) 生成物を配置
cp "$WORK/dist/ft8.mjs" "$WORK/dist/ft8.wasm" "$ROOT/src/audio/wasm/"
echo "Updated: src/audio/wasm/ft8.{mjs,wasm}"
