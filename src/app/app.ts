import { createAudioEngine } from '../audio/engine'
import type { AudioEngine } from '../audio/engine'
import { parseMessage } from '../domain/message'
import { validateName } from '../domain/name'
import { chooseOffset } from '../domain/offset'
import { createQsoLogStore } from '../domain/log'
import type { QsoLogStore } from '../domain/log'
import { createQsoMachine } from '../domain/qso'
import type { QsoAction, QsoMachine } from '../domain/qso'
import type { SlotParity } from '../domain/slot'
import { createSlotScheduler } from './slotScheduler'
import type { SlotScheduler } from './slotScheduler'

type View = 'dialog' | 'main' | 'denied'

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

const STATUS_LABELS: Record<string, string> = {
  idle: '受信中',
  cq_calling: 'CQ 送信中 / 応答待ち',
  cq_answering: '応答受信 / 73 送信中',
  resp_replying: '応答送信中 / 相手待ち',
  resp_finishing: '73 送信中',
  done: '交信成立',
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
  const scheduler = deps.scheduler ?? createSlotScheduler()

  let view: View = 'dialog'
  let name = ''
  let offsetHz = 0
  let machine: QsoMachine | null = null
  let deniedReason = ''

  function statusLabel(): string {
    return STATUS_LABELS[machine?.state.kind ?? 'idle'] ?? '受信中'
  }

  function applyActions(actions: QsoAction[]): void {
    for (const action of actions) {
      if (action.type === 'transmit') {
        void engine.transmit(action.text, offsetHz)
      } else if (action.type === 'completed') {
        // AC-21: 交信成立で相手をログに保存。
        store.add({ name: action.peer, at: Date.now() })
      }
    }
    render()
  }

  async function handleSlot(parity: SlotParity): Promise<void> {
    if (!machine) return
    // 1) 直前スロットの受信音声をデコードして machine に投入する。自局の送信(from === 自分)は無視。
    for (const decoded of await engine.decodeRecentAudio()) {
      const parsed = parseMessage(decoded.text)
      if (!parsed || parsed.from === name) continue
      applyActions(
        machine.dispatch({ type: 'decode', text: decoded.text, offsetHz: decoded.offsetHz }),
      )
    }
    // 2) このスロットの送信判断(AC-8 EVEN / AC-9 ODD)。
    applyActions(machine.dispatch({ type: 'slot', parity }))
  }

  async function onStart(value: string, errorEl: HTMLElement): Promise<void> {
    const result = validateName(value)
    if (!result.ok) {
      errorEl.textContent = result.reason // AC-2
      errorEl.hidden = false
      return
    }
    name = result.name
    try {
      await engine.init() // AC-3: AudioContext 確立 + マイク許可
    } catch (error) {
      deniedReason = error instanceof Error ? error.message : String(error)
      view = 'denied' // AC-5
      render()
      return
    }
    offsetHz = chooseOffset() // AC-10
    machine = createQsoMachine({ me: name, isKnown: (n) => store.has(n) })
    scheduler.start(handleSlot)
    view = 'main' // AC-4
    render()
  }

  function renderDialog(): HTMLElement {
    const input = h('input', {
      type: 'text',
      maxLength: 3,
      placeholder: 'ABC',
      autocapitalize: 'characters',
      dataset: { testid: 'name-input' },
      attrs: { 'aria-label': '名前(3文字)' },
    })
    const error = h('p', { className: 'error', hidden: true, dataset: { testid: 'name-error' } })
    const startButton = h('button', {
      className: 'primary',
      textContent: '開始',
      dataset: { testid: 'start-button' },
    })
    startButton.onclick = () => void onStart(input.value, error)

    return h(
      'section',
      { className: 'dialog', dataset: { testid: 'name-dialog' }, attrs: { role: 'dialog' } },
      h('h1', { textContent: 'FT8 名刺交換デモ' }),
      // AC-1: 注意文(マイクで収録 / スピーカーから音 / 収録音声は保存・送信しない)。
      h('p', {
        className: 'notice',
        textContent:
          'このデモはマイクで音声を収録し、スピーカーから音が出ます。収録した音声はデコードだけに使い、保存も送信もしません。',
      }),
      h('label', { textContent: '3 文字の名前(A-Z / 0-9)' }),
      input,
      error,
      startButton,
    )
  }

  function renderLog(): HTMLElement {
    const entries = store.list()
    const list = h('ul', { className: 'log', dataset: { testid: 'qso-log' } })
    if (entries.length === 0) {
      list.append(h('li', { className: 'log-empty', textContent: 'まだ交信はありません' }))
    } else {
      for (const entry of entries) {
        const remove = h('button', { className: 'ghost', textContent: '削除' })
        remove.onclick = () => {
          store.remove(entry.name) // AC-23
          render()
        }
        list.append(h('li', {}, h('span', { className: 'peer', textContent: entry.name }), remove))
      }
    }
    return list
  }

  function renderRename(): HTMLElement {
    const input = h('input', {
      type: 'text',
      maxLength: 3,
      value: name,
      autocapitalize: 'characters',
      attrs: { 'aria-label': '名前を変更' },
    })
    const error = h('p', { className: 'error', hidden: true })
    const apply = h('button', { className: 'ghost', textContent: '名前変更' })
    apply.onclick = () => {
      const result = validateName(input.value) // AC-6: 3 文字ルールで検証
      if (!result.ok) {
        error.textContent = result.reason
        error.hidden = false
        return
      }
      name = result.name
      // 以降の送信で新しい名前を用いる。待機中なら機械を作り直す。
      machine = createQsoMachine({ me: name, isKnown: (n) => store.has(n) })
      render()
    }
    return h(
      'details',
      { className: 'rename' },
      h('summary', { textContent: '名前を変更' }),
      input,
      apply,
      error,
    )
  }

  function renderMain(): HTMLElement {
    const startSequence = h('button', { className: 'primary', textContent: 'Start Sequence' })
    startSequence.onclick = () => {
      if (machine) applyActions(machine.dispatch({ type: 'start_sequence' })) // AC-12
    }

    const ft8Note = engine.ft8Ready
      ? null
      : h('p', {
          className: 'warn',
          textContent: 'FT8 音声エンジン(WASM)は未同梱です。送受信は WASM 同梱後に有効になります。',
        })

    return h(
      'section',
      { className: 'main', dataset: { testid: 'main-screen' } },
      h(
        'header',
        { className: 'topbar' },
        h('span', { className: 'me', textContent: `自局: ${name}` }),
        // AC-31: 交信人数。
        h('span', { className: 'count', textContent: `交信: ${store.count()} 人` }),
      ),
      // AC-13: 送信中/応答待ちなどの状態表示。
      h('div', {
        className: 'status',
        dataset: { testid: 'status' },
        textContent: `状態: ${statusLabel()}`,
      }),
      startSequence,
      ...(ft8Note ? [ft8Note] : []),
      h('h2', { textContent: '交信ログ' }),
      renderLog(), // AC-22
      renderRename(), // AC-6
      // AC-30: time.is への外部リンク。
      h('a', {
        className: 'timeis',
        href: 'https://time.is/',
        textContent: 'time.is で時刻を確認',
        target: '_blank',
        rel: 'noreferrer',
      }),
    )
  }

  function renderDenied(): HTMLElement {
    return h(
      'section',
      { className: 'denied', dataset: { testid: 'denied-screen' } },
      h('h1', { textContent: '送受信できません' }),
      h('p', { dataset: { testid: 'denied-message' }, textContent: deniedReason }),
      h('p', { textContent: 'マイクを許可するには、ページを再読み込みして再試行してください。' }),
    )
  }

  function render(): void {
    root.replaceChildren(
      view === 'dialog' ? renderDialog() : view === 'main' ? renderMain() : renderDenied(),
    )
  }

  return {
    mount() {
      render()
    },
  }
}
