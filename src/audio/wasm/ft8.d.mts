// 型宣言: Emscripten が生成する ft8.mjs(MODULARIZE / EXPORT_ES6 / EXPORT_NAME=createFt8）。
// 生成物のため手で編集しない。再生成は scripts/build-ft8-wasm.sh を参照。
export interface Ft8Module {
  _malloc(size: number): number
  _free(ptr: number): void
  ccall(
    name: string,
    returnType: 'number' | 'string' | null,
    argTypes: string[],
    args: unknown[],
  ): unknown
  UTF8ToString(ptr: number): string
  /** WASM ヒープの Float32 ビュー(メモリ成長で再生成されうるため都度参照する)。 */
  readonly HEAPF32: Float32Array
  readonly HEAPU8: Uint8Array
}

export interface Ft8ModuleOptions {
  locateFile?: (path: string, scriptDirectory: string) => string
  wasmBinary?: ArrayBuffer
  print?: (text: string) => void
  printErr?: (text: string) => void
}

declare const createFt8: (options?: Ft8ModuleOptions) => Promise<Ft8Module>
export default createFt8
