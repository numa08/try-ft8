import './style.css'
import { createApp } from './app/app'

// アプリのエントリポイント。UI・音声・時刻同期の結線は app/ 以下に閉じ込める。
const root = document.querySelector<HTMLDivElement>('#app')
if (root) {
  createApp(root).mount()
}
