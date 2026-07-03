// 画面文言の多言語化(日本語・英語のみ)。
// UI は renderApp() でフル再描画されるため、現在の言語はモジュール内の
// 単一状態として保持し、t() で参照する。技術ラベル(BAND / CALL CQ など)は
// 無線の慣用表現として両言語で共通にし、散文のみ翻訳する。

export type Lang = 'ja' | 'en'

/** 言語設定の保存キー。 */
export const LANG_STORAGE_KEY = 'ft8-demo/lang'

export interface Dict {
  htmlLang: string
  langToggle: string // このボタンを押すと切り替わる先の言語名
  setupTitle: string
  setupDesc: string
  namePlaceholder: string
  nameAria: string
  startBtn: string
  noticeTitle: string
  notices: string[]
  playGuide: string
  nameError: string
  changeName: string
  subCqCalling: string
  subCqAnswering: (peer: string) => string
  subRespReplying: (peer: string) => string
  subRespFinishing: (peer: string) => string
  subDone: (peer: string) => string
  subMonitoring: string
  sysQsoComplete: (peer: string) => string
  sysNoAnswer: string
  sysSendingCq: string
  offsetUnsynced: string
  offset: (sign: string, seconds: string) => string
  monitorEmpty: string
  logbookEmpty: string
  deniedTitle: string
  deniedHelp: string
}

const ja: Dict = {
  htmlLang: 'ja',
  langToggle: 'EN',
  setupTitle: 'ハンドルネームを設定',
  setupDesc: 'A〜Z / 0〜9 でちょうど 3 文字。交信時に相手へ表示されます。',
  namePlaceholder: '例: ABC',
  nameAria: '名前(3文字)',
  startBtn: '開始',
  noticeTitle: 'ご利用にあたって',
  notices: [
    '本アプリは微弱電波の通信方式「FT8」を音で体験するデモです。',
    'マイクの使用許可を求めます(音声は端末内でのデコードにのみ使用します)。',
    'スピーカーから音が鳴ります。音量と周囲の環境に注意してください。',
    '収録した音声は保存も送信もしません。',
  ],
  playGuide:
    '2台以上のスマホを並べ、片方で「CALL CQ」を押すと FT8 の信号を送出できます。お互いの名前を交換してみましょう。',
  nameError: '名前は大文字英数字(A-Z, 0-9)ちょうど3文字で入力してください',
  changeName: '名前を変更',
  subCqCalling: 'CQ 送出 · 応答待ち',
  subCqAnswering: (peer) => `${peer} と交信中 · 73 送信`,
  subRespReplying: (peer) => `${peer} へ応答中`,
  subRespFinishing: (peer) => `${peer} へ 73 送信`,
  subDone: (peer) => `${peer} と交信成立`,
  subMonitoring: 'CQ を受信待ち…',
  sysQsoComplete: (peer) => `QSO 成立 · ${peer}`,
  sysNoAnswer: '応答なし · 待機',
  sysSendingCq: 'CQ を送信します…',
  offsetUnsynced: '時刻補正 未同期',
  offset: (sign, seconds) => `時刻補正 ${sign}${seconds}s`,
  monitorEmpty: 'バンドを受信中… まだ信号はありません',
  logbookEmpty: 'まだ交信はありません',
  deniedTitle: '送受信できません',
  deniedHelp: 'マイクを許可するには、ページを再読み込みして再試行してください。',
}

const en: Dict = {
  htmlLang: 'en',
  langToggle: '日本語',
  setupTitle: 'Set your handle',
  setupDesc: 'Exactly 3 characters from A–Z / 0–9. Shown to the other station during a QSO.',
  namePlaceholder: 'e.g. ABC',
  nameAria: 'Handle (3 characters)',
  startBtn: 'Start',
  noticeTitle: 'Before you start',
  notices: [
    'This app is a demo for experiencing the weak-signal mode “FT8” through sound.',
    'It will ask for microphone permission (audio is used only for on-device decoding).',
    'Sound plays from the speaker. Mind the volume and your surroundings.',
    'Recorded audio is never saved or transmitted.',
  ],
  playGuide:
    'Line up two or more phones and tap “CALL CQ” on one to send an FT8 signal. Try exchanging your handles with each other!',
  nameError: 'Enter exactly 3 characters using A–Z and 0–9.',
  changeName: 'Change handle',
  subCqCalling: 'Calling CQ · waiting for a reply',
  subCqAnswering: (peer) => `In QSO with ${peer} · sending 73`,
  subRespReplying: (peer) => `Replying to ${peer}`,
  subRespFinishing: (peer) => `Sending 73 to ${peer}`,
  subDone: (peer) => `QSO completed with ${peer}`,
  subMonitoring: 'Waiting to receive a CQ…',
  sysQsoComplete: (peer) => `QSO complete · ${peer}`,
  sysNoAnswer: 'No answer · standing by',
  sysSendingCq: 'Sending CQ…',
  offsetUnsynced: 'Clock offset: not synced',
  offset: (sign, seconds) => `Clock offset ${sign}${seconds}s`,
  monitorEmpty: 'Listening to the band… no signals yet',
  logbookEmpty: 'No QSOs yet',
  deniedTitle: 'Cannot transmit or receive',
  deniedHelp: 'To allow the microphone, reload the page and try again.',
}

const DICTS: Record<Lang, Dict> = { ja, en }

let current: Lang = 'ja'

function detect(storage: Storage, nav: { language: string }): Lang {
  try {
    const saved = storage.getItem(LANG_STORAGE_KEY)
    if (saved === 'ja' || saved === 'en') return saved
  } catch {
    // storage 使用不可時はブラウザ言語にフォールバック。
  }
  return (nav.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

/** 保存済み設定またはブラウザ言語から初期言語を決定し、<html lang> に反映する。 */
export function initLang(
  storage: Storage = localStorage,
  nav: { language: string } = navigator,
): Lang {
  current = detect(storage, nav)
  document.documentElement.lang = DICTS[current].htmlLang
  return current
}

export function getLang(): Lang {
  return current
}

/** 言語を切り替えて永続化し、<html lang> に反映する。 */
export function setLang(lang: Lang, storage: Storage = localStorage): void {
  current = lang
  document.documentElement.lang = DICTS[lang].htmlLang
  try {
    storage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // storage 使用不可時は当該セッションでのみ有効。
  }
}

/** 現在の言語の辞書を返す。 */
export function t(): Dict {
  return DICTS[current]
}
