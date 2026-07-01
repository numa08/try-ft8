# Third-Party Licenses

本プロジェクトは以下のサードパーティ製ソフトウェアを利用・同梱しています。

## ft8_lib

FT8 のエンコード・デコード中核は [ft8_lib](https://github.com/kgoba/ft8_lib)
(Kārlis Goba 作、MIT License)を利用しています。

- 同梱バイナリ: `src/audio/wasm/ft8.wasm` / `src/audio/wasm/ft8.mjs`
  (ft8_lib を Emscripten で WASM 化した生成物。ft8_lib のコードを含みます)
- 派生コード: `src/audio/wasm/encode_samples.c` の `gfsk_pulse` / `synth_gfsk`
  (ft8_lib の `demo/gen_ft8.c` 由来)、`src/audio/wasm/decode_samples.c` の
  コールサイン用ハッシュテーブル(ft8_lib の `demo/decode_ft8.c` 由来)

ft8_lib のライセンス全文:

```
MIT License

Copyright (c) 2018 Kārlis Goba

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
