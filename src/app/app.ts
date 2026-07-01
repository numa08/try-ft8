import { createAudioEngine } from '../audio/engine'
import type { AudioEngine } from '../audio/engine'
import { parseMessage } from '../domain/message'
import { validateName } from '../domain/name'
import { chooseOffset } from '../domain/offset'
import { createQsoLogStore } from '../domain/log'
import type { QsoLogStore } from '../domain/log'
import { loadHandle, saveHandle } from '../domain/handle'
import { createQsoMachine } from '../domain/qso'
import type { QsoAction, QsoMachine } from '../domain/qso'
import { SLOT_MS } from '../domain/slot'
import type { SlotParity } from '../domain/slot'
import { createClock } from '../domain/clock'
import { createSlotScheduler } from './slotScheduler'
import type { SlotScheduler } from './slotScheduler'
import { syncClock } from './timeSync'

const ACCENT = '#2fe6a8'
const BLUE = '#5aa8ff'
const MUTED = '#7b818b'
const RX_TEXT = '#dfe3ea'

type Tab = 'monitor' | 'log'
type ActivityDir = 'tx' | 'rx' | 'sys'

interface ActivityEntry {
  dir: ActivityDir
  text: string
  meta: string
  time: string
}

type ElementProps<K extends keyof HTMLElementTagNameMap> = Partial<HTMLElementTagNameMap[K]> & {
  dataset?: Record<string, string>
  attrs?: Record<string, string>
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps<K> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  const { dataset, attrs, ...rest } = props
  Object.assign(node, rest)
  if (dataset) {
    for (const [key, value] of Object.entries(dataset)) node.dataset[key] = value
  }
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  }
  node.append(...children)
  return node
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function clockNow(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatWhen(at: number): string {
  const d = new Date(at)
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

interface StatusView {
  label: string
  sub: string
  color: string
  role: 'TX' | 'RX'
}

export interface App {
  mount(): void
}

export function createApp(
  root: HTMLElement,
  deps: { engine?: AudioEngine; store?: QsoLogStore; scheduler?: SlotScheduler } = {},
): App {
  const engine = deps.engine ?? createAudioEngine()
  const store = deps.store ?? createQsoLogStore()
  // AC-7 / AC-34: 送受信の計時は補正時刻(clock.now)に基づく。
  const clock = createClock()
  const scheduler = deps.scheduler ?? createSlotScheduler(() => clock.now())

  let name = ''
  let setupValue = ''
  let setupError = ''
  let offsetHz = 0
  let tab: Tab = 'monitor'
  let needsSetup = true
  let micReady = false
  let denied = false
  let deniedReason = ''
  let machine: QsoMachine | null = null
  const activity: ActivityEntry[] = []

  // スロットタイムラインをフル再描画せず 4Hz で更新するための参照。
  let slotFillEl: HTMLElement | null = null
  let slotRemainEl: HTMLElement | null = null

  function pushActivity(dir: ActivityDir, text: string, meta = ''): void {
    activity.unshift({ dir, text, meta, time: clockNow() })
    if (activity.length > 80) activity.length = 80
  }

  function statusView(): StatusView {
    const kind = machine?.state.kind ?? 'idle'
    const peer = machine?.state.peer ?? ''
    switch (kind) {
      case 'cq_calling':
        return { label: 'CALLING CQ', sub: 'CQ 送出 · 応答待ち', color: ACCENT, role: 'TX' }
      case 'cq_answering':
        return { label: 'IN QSO', sub: `${peer} と交信中 · 73 送信`, color: ACCENT, role: 'TX' }
      case 'resp_replying':
        return { label: 'IN QSO', sub: `${peer} へ応答中`, color: ACCENT, role: 'TX' }
      case 'resp_finishing':
        return { label: 'IN QSO', sub: `${peer} へ 73 送信`, color: ACCENT, role: 'TX' }
      case 'done':
        return { label: 'QSO COMPLETE', sub: `${peer} と交信成立`, color: ACCENT, role: 'RX' }
      default:
        return { label: 'MONITORING', sub: 'CQ を受信待ち…', color: BLUE, role: 'RX' }
    }
  }

  function applyActions(actions: QsoAction[]): void {
    for (const action of actions) {
      if (action.type === 'transmit') {
        pushActivity('tx', action.text)
        void engine.transmit(action.text, offsetHz)
      } else if (action.type === 'completed') {
        // AC-21: 交信成立で相手をログに保存。
        pushActivity('sys', `QSO 成立 · ${action.peer}`)
        store.add({ name: action.peer, at: Date.now() })
      } else if (action.type === 'waiting') {
        pushActivity('sys', '応答なし · 待機')
      }
    }
  }

  async function handleSlot(parity: SlotParity): Promise<void> {
    if (!machine) return
    // 1) 直前スロットの受信音声をデコードし machine に投入。自局送信(from === 自分)は無視。
    for (const decoded of await engine.decodeRecentAudio()) {
      const parsed = parseMessage(decoded.text)
      if (!parsed || parsed.from === name) continue
      pushActivity('rx', decoded.text, `${Math.round(decoded.offsetHz)}Hz`)
      applyActions(
        machine.dispatch({ type: 'decode', text: decoded.text, offsetHz: decoded.offsetHz }),
      )
    }
    // 2) このスロットの送信判断(AC-8 EVEN / AC-9 ODD)。
    applyActions(machine.dispatch({ type: 'slot', parity }))
    renderApp()
  }

  function onCallCQ(): void {
    if (!machine) return
    pushActivity('sys', 'CQ を送信します…') // AC-12
    applyActions(machine.dispatch({ type: 'start_sequence' }))
    renderApp()
  }

  async function runTimeSync(): Promise<void> {
    await syncClock(clock)
    renderApp() // AC-30: 適用オフセットの表示を更新
  }

  function formatOffset(): string {
    if (!clock.synced) {
      return '時刻補正 未同期'
    }
    const seconds = clock.offsetMs() / 1000
    const sign = seconds >= 0 ? '+' : '−'
    return `時刻補正 ${sign}${Math.abs(seconds).toFixed(2)}s`
  }

  function openSetup(): void {
    setupValue = name
    setupError = ''
    needsSetup = true
    renderApp()
  }

  async function onStart(): Promise<void> {
    const result = validateName(setupValue) // AC-2 / AC-6
    if (!result.ok) {
      setupError = result.reason
      renderApp()
      return
    }
    name = result.name
    setupError = ''
    saveHandle(name) // AC-33: 確定した名前を永続化
    if (!micReady) {
      try {
        await engine.init() // AC-3
      } catch (error) {
        denied = true // AC-5
        deniedReason = error instanceof Error ? error.message : String(error)
        renderApp()
        return
      }
      micReady = true
      offsetHz = chooseOffset() // AC-10
      scheduler.start(handleSlot)
      void runTimeSync() // AC-34: 起動時に時刻オフセットを取得・適用
    }
    machine = createQsoMachine({ me: name, isKnown: (n) => store.has(n) })
    needsSetup = false
    renderApp()
  }

  // 文字種のみ正規化(大文字・英数字)。長さは検証(validateName)に委ね、
  // 3 文字超は理由表示で弾く(通常入力は input の maxlength=3 で抑止)。
  function normalizeName(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  // ---- render pieces ----

  function renderHeader(): HTMLElement {
    const pill = h(
      'button',
      { className: 'handle-pill', attrs: { 'aria-label': '名前を変更' } },
      h('span', { className: 'tag mono', textContent: 'DEMO' }),
      h('span', { className: 'sep' }),
      h('span', { className: 'val mono', textContent: name || '—' }),
    )
    pill.onclick = openSetup
    return h(
      'div',
      { className: 'header' },
      h(
        'div',
        { className: 'brand' },
        h('span', { className: 'brand-dot' }),
        h('span', { className: 'brand-name', textContent: 'Try! FT8' }),
        h('span', { className: 'brand-sub mono', textContent: 'ACOUSTIC LINK' }),
      ),
      pill,
    )
  }

  function renderStatusCard(): HTMLElement {
    const view = statusView()
    const slotColor = view.role === 'TX' ? ACCENT : BLUE

    const value = h('div', { className: 'status-value', textContent: view.label })
    value.style.color = view.color

    const eq = h('div', { className: 'eq' })
    eq.style.opacity = '0.5'
    for (let i = 0; i < 5; i++) {
      const bar = h('div', { className: 'eq-bar' })
      bar.style.background = slotColor
      eq.append(bar)
    }

    const role = h('span', { className: 'slot-role mono', textContent: `SLOT · ${view.role}` })
    role.style.color = slotColor
    const freq = micReady ? `${Math.round(offsetHz)}Hz` : '—'
    slotRemainEl = h('span', { className: 'slot-meta mono', textContent: `${freq} · --s` })

    slotFillEl = h('div', { className: 'slot-fill' })
    slotFillEl.style.background = slotColor
    slotFillEl.style.width = '0%'

    // AC-30: 算出・適用した時刻オフセットの表示(time.is リンクは廃止)。
    const offsetView = h('div', {
      className: 'clock-offset mono',
      textContent: formatOffset(),
      dataset: { testid: 'clock-offset' },
    })

    updateSlotTimeline() // 初期値を反映

    return h(
      'div',
      { className: 'status-card' },
      h(
        'div',
        { className: 'status-row' },
        h(
          'div',
          {},
          h('div', { className: 'status-label mono', textContent: 'STATUS' }),
          value,
          h('div', { className: 'status-sub mono', textContent: view.sub }),
        ),
        eq,
      ),
      h(
        'div',
        { className: 'slot' },
        h('div', { className: 'slot-head' }, role, slotRemainEl),
        h('div', { className: 'slot-track' }, slotFillEl),
      ),
      offsetView,
    )
  }

  function renderAction(): HTMLElement {
    const button = h(
      'button',
      { className: 'cq-btn', attrs: { 'aria-label': 'Start Sequence' } },
      h('span', { className: 'dot' }),
      'CALL CQ',
    )
    button.onclick = onCallCQ
    return h('div', { className: 'action' }, button)
  }

  function renderTabs(): HTMLElement {
    const monitor = h('button', {
      className: tab === 'monitor' ? 'tab tab--active' : 'tab',
      textContent: 'BAND',
    })
    monitor.onclick = () => {
      tab = 'monitor'
      renderApp()
    }
    const log = h('button', {
      className: tab === 'log' ? 'tab tab--active' : 'tab',
      textContent: `LOGBOOK · ${store.count()}`,
    })
    log.onclick = () => {
      tab = 'log'
      renderApp()
    }
    return h('div', { className: 'tabs' }, monitor, log)
  }

  function renderMonitor(): HTMLElement[] {
    if (activity.length === 0) {
      return [
        h('div', { className: 'list-empty', textContent: 'バンドを受信中… まだ信号はありません' }),
      ]
    }
    return activity.map((entry) => {
      const tag = entry.dir === 'tx' ? 'TX' : entry.dir === 'rx' ? 'RX' : '·'
      const tagColor = entry.dir === 'tx' ? ACCENT : entry.dir === 'rx' ? BLUE : MUTED
      const textColor = entry.dir === 'tx' ? ACCENT : entry.dir === 'rx' ? RX_TEXT : MUTED
      const tagEl = h('span', { className: 'log-tag mono', textContent: tag })
      tagEl.style.color = tagColor
      const textEl = h('span', { className: 'log-text mono', textContent: entry.text })
      textEl.style.color = textColor
      return h(
        'div',
        { className: 'log-row' },
        h('span', { className: 'log-time mono', textContent: entry.time }),
        tagEl,
        textEl,
        h('span', { className: 'log-meta mono', textContent: entry.meta }),
      )
    })
  }

  function renderLogbook(): HTMLElement[] {
    const clear = h('button', { className: 'book-clear', textContent: 'CLEAR LOG' })
    clear.onclick = () => {
      store.clear() // AC-23
      renderApp()
    }
    const head = h('div', { className: 'book-head' }, clear)

    const entries = store.list() // AC-22
    if (entries.length === 0) {
      return [head, h('div', { className: 'list-empty', textContent: 'まだ交信はありません' })]
    }
    const cards = entries.map((entry) =>
      h(
        'div',
        { className: 'book-card' },
        h(
          'div',
          { className: 'book-left' },
          h('div', { className: 'book-avatar', textContent: entry.name.charAt(0) }),
          h(
            'div',
            {},
            h('div', { className: 'book-handle mono', textContent: entry.name }),
            h('div', { className: 'book-when mono', textContent: formatWhen(entry.at) }),
          ),
        ),
        h('div', { className: 'book-count mono', textContent: '' }),
      ),
    )
    return [head, ...cards]
  }

  function renderList(): HTMLElement {
    const children = tab === 'monitor' ? renderMonitor() : renderLogbook()
    // AC-22: ログ一覧 UI。テストの qso-log アンカーは常時表示のリスト領域に置く。
    return h('div', { className: 'list', dataset: { testid: 'qso-log' } }, ...children)
  }

  function renderSetupOverlay(): HTMLElement {
    const input = h('input', {
      className: 'setup-input',
      type: 'text',
      value: setupValue,
      // 3 文字超の入力も検証で理由表示するため、入力自体は少し余裕を持たせる(AC-2)。
      maxLength: 6,
      placeholder: '例: ABC',
      autocapitalize: 'characters',
      autocomplete: 'off',
      spellcheck: false,
      dataset: { testid: 'name-input' },
      attrs: { 'aria-label': '名前(3文字)' },
    })
    input.oninput = () => {
      const normalized = normalizeName(input.value)
      input.value = normalized
      setupValue = normalized
    }
    input.onkeydown = (event) => {
      if (event.key === 'Enter') void onStart()
    }

    const error = h('p', {
      className: 'setup-error',
      hidden: setupError === '',
      textContent: setupError,
      dataset: { testid: 'name-error' },
    })

    const start = h('button', {
      className: 'start-btn',
      textContent: '開始',
      dataset: { testid: 'start-button' },
    })
    start.onclick = () => void onStart()

    // AC-1: マイク収録 / スピーカー / 保存・送信しない の注意文。
    const notices: string[] = [
      '本アプリは微弱電波の通信方式「FT8」を音で体験するデモです。',
      'マイクの使用許可を求めます(音声は端末内でのデコードにのみ使用します)。',
      'スピーカーから音が鳴ります。音量と周囲の環境に注意してください。',
      '収録した音声は保存も送信もしません。',
    ]
    const notice = h(
      'div',
      { className: 'notice jp' },
      h('div', { className: 'notice-title', textContent: 'ご利用にあたって' }),
      ...notices.map((text) =>
        h(
          'div',
          { className: 'notice-item' },
          h('span', { className: 'notice-dot' }),
          h('span', { className: 'notice-text', textContent: text }),
        ),
      ),
    )

    const card = h(
      'div',
      { className: 'setup', dataset: { testid: 'name-dialog' }, attrs: { role: 'dialog' } },
      h('div', { className: 'setup-kicker mono', textContent: 'FT8 · ACOUSTIC LINK' }),
      h('div', { className: 'setup-title jp', textContent: 'ハンドルネームを設定' }),
      h('div', {
        className: 'setup-desc jp',
        textContent: 'A〜Z / 0〜9 でちょうど 3 文字。交信時に相手へ表示されます。',
      }),
      input,
      error,
      notice,
      start,
    )
    return h('div', { className: 'overlay' }, card)
  }

  function renderDeniedOverlay(): HTMLElement {
    const card = h(
      'div',
      { className: 'setup jp', dataset: { testid: 'denied-dialog' } },
      h('div', { className: 'setup-kicker mono', textContent: 'FT8 · ACOUSTIC LINK' }),
      h('div', { className: 'setup-title', textContent: '送受信できません' }),
      h('div', {
        className: 'setup-desc',
        textContent: deniedReason,
        dataset: { testid: 'denied-message' },
      }),
      h('div', {
        className: 'setup-desc',
        textContent: 'マイクを許可するには、ページを再読み込みして再試行してください。',
      }),
    )
    return h('div', { className: 'overlay' }, card)
  }

  function updateSlotTimeline(): void {
    if (!slotFillEl || !slotRemainEl) return
    const intoSlot = Date.now() % SLOT_MS
    const ratio = intoSlot / SLOT_MS
    slotFillEl.style.width = `${(ratio * 100).toFixed(1)}%`
    const remain = Math.ceil((SLOT_MS - intoSlot) / 1000)
    const freq = micReady ? `${Math.round(offsetHz)}Hz` : '—'
    slotRemainEl.textContent = `${freq} · ${remain}s`
  }

  function renderApp(): void {
    const app = h(
      'div',
      { className: 'app', dataset: { testid: 'main-screen' } },
      renderHeader(),
      renderStatusCard(),
      renderAction(),
      renderTabs(),
      renderList(),
    )
    if (denied) {
      app.append(renderDeniedOverlay())
    } else if (needsSetup) {
      app.append(renderSetupOverlay())
    }
    root.replaceChildren(app)
  }

  return {
    mount() {
      // AC-33: 保存済みの名前があれば復元し、入力の初期値にする。
      const saved = loadHandle()
      if (saved !== null) {
        name = saved
        setupValue = saved
      }
      renderApp()
      // スロットタイムラインを 4Hz で更新(フル再描画はしない)。
      setInterval(updateSlotTimeline, 250)
    },
  }
}
