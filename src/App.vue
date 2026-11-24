<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowDown, ArrowLeft, Bookmark, CheckCheck, Copy, FileText, FlaskConical, Forward, Gauge, Image as ImageIcon, Info,
  ListChecks, Menu, MessageCircle, Mic, Moon, MoreVertical, Paperclip, Reply, Search, Send, Settings, Settings2,
  Smile, Sparkles, Trash2, X, Zap
} from 'lucide-vue-next'
import { vRipple } from './ripple'
import { createChatData, PAGE, type Message, type Chat } from './chat/data'
import { buildRows, dayDiff } from './chat/rows'
import { useFps } from './chat/useFps'
import { createReplySwipe } from './chat/replySwipe'
import { burst, cancelFlight, flyBubble, flyEmoji, revealFrom, play, settle } from './motion'
import { createScrollSaver } from '../packages/motion/index.js'
import {
  animationList, durationFor, easing, easingFor, effectiveLevel, isEnabled, microDuration, moveDurationFor,
  powerSavingActive, resolvedTheme, settings, system, watchEnvironment, type DemoKey, type SettingsTab, type ThemeMode
} from './settings'
// Async so the settings UI stays out of the critical first paint (P1 perf).
const SettingsPanel = defineAsyncComponent(() => import('./components/SettingsPanel.vue'))
/* ------------------------------------------------------------------ data */

const { chats, data } = createChatData()
/** tweb sweep maths: damped finger-following, trigger at a fraction of the cap. */
const swipeMaxPx = () => settings.mech.swipeMax
const swipeTriggerPx = () => Math.round(settings.mech.swipeMax * settings.mech.swipeTrigger)

let nextId = 100

const replies = ['收到 👍', '这个曲线确实更顺！', '再放慢 5 倍看看细节？', '弹簧预设很有意思 😄', '我这边也试一下', '👌 完美', '省电模式下也很流畅']
let replyIndex = 0

/* ------------------------------------------------------------------ refs & ui state */

const stageRef = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const settingsRef = ref<{ go: (tab: SettingsTab) => void; back: () => void } | null>(null)

const activeId = ref(1)
const text = ref('')
const query = ref('')
const searchFocused = ref(false)
const folder = ref<'all' | 'unread' | 'groups'>('all')
const visibleCount = ref(PAGE)
const quiet = ref(false)
const pending = reactive(new Set<number>())
const typing = reactive<Record<number, boolean>>({})
const reply = ref<Message | null>(null)
const highlightId = ref<number | null>(null)
const showFab = ref(false)
const fabUnread = ref(0)
const wallStep = ref(0)
const toast = ref('')

const sidebarView = ref<'chats' | 'settings'>('chats')
const sidebarDir = ref<'push' | 'pop'>('push')
const settingsEntry = ref<SettingsTab>('main')
const isMobile = ref(false)
const mobileChatOpen = ref(false)
const chatDir = ref<'next' | 'prev'>('next')

const mainMenu = ref(false)
const headerMenu = ref(false)
const attachMenu = ref(false)
const showEmoji = ref(false)
const showAbout = ref(false)
const msgMenu = ref<{ id: number; x: number; y: number; origin: string } | null>(null)

const {fps,worstFrame}=useFps(()=>settings.showFps)

const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const t = setTimeout(() => { timers.delete(t); fn() }, ms)
  timers.add(t)
}
const wait = (ms: number) => new Promise<void>(resolve => later(resolve, ms))

/** Keeps the viewport pinned to a visible message row across list mutations (tweb scrollSaver). */
const scrollSaver = createScrollSaver(() => scrollEl.value, '.message-row', 'data-row')

/* ------------------------------------------------------------------ derived */

const activeChat = computed<Chat>(() => chats.find(c => c.id === activeId.value) ?? chats[0] as Chat)
const lastOf = (id: number): Message | undefined => {
  const list = data[id]
  return list && list.length ? list[list.length - 1] : undefined
}
const sortedChats = computed(() => [...chats].sort((a, b) =>
  Number(!!b.pinned) - Number(!!a.pinned) || (lastOf(b.id)?.at ?? 0) - (lastOf(a.id)?.at ?? 0)))
const folders = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'groups', label: '群组' }
] as const
const unreadChats = computed(() => chats.filter(c => c.unread > 0).length)
const searching = computed(() => searchFocused.value || query.value.length > 0)
const listChats = computed(() => {
  const q = query.value.trim().toLowerCase()
  return sortedChats.value.filter(c => {
    if (folder.value === 'unread' && !c.unread) return false
    if (folder.value === 'groups' && !c.group) return false
    if (!q) return true
    return (c.name + ' ' + (lastOf(c.id)?.text ?? '')).toLowerCase().includes(q)
  })
})

const messages = computed(() => data[activeId.value] ?? [])
const visibleMessages = computed(() => messages.value.slice(-visibleCount.value))
const hiddenCount = computed(() => Math.max(0, messages.value.length - visibleCount.value))

const timeFmt = computed(() => settings.timeFormat === '12h'
  ? new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: true })
  : new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }))
const fmtTime = (at: number) => timeFmt.value.format(at)
function listTime(at: number) {
  const diff = dayDiff(at)
  if (diff === 0) return fmtTime(at)
  if (diff === 1) return '昨天'
  if (diff < 7) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(at).getDay()] ?? ''
  const d = new Date(at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const rows = computed(() => buildRows(visibleMessages.value))

const status = computed(() => {
  const c = activeChat.value
  if (typing[c.id]) return { text: c.group ? 'Alex 正在输入' : '正在输入', accent: true, typing: true }
  if (c.saved) return { text: c.status, accent: false, typing: false }
  if (c.online) return { text: '在线', accent: true, typing: false }
  return { text: c.status, accent: false, typing: false }
})
const canSend = computed(() => text.value.trim().length > 0)
const anyPopup = computed(() => mainMenu.value || headerMenu.value || attachMenu.value || showEmoji.value || !!msgMenu.value)

const wallPositions: [number, number][] = [[0.82, 0.12], [0.6, 0.24], [0.34, 0.24], [0.24, 0.58], [0.18, 0.88], [0.42, 0.78], [0.68, 0.76], [0.78, 0.44]]
const blobs = computed(() => [0, 1, 2, 3].map(i => {
  const p = wallPositions[(wallStep.value + i * 2) % wallPositions.length] ?? [0.5, 0.5]
  return { transform: `translate3d(${((p[0] - 0.5) * 83).toFixed(2)}%, ${((p[1] - 0.5) * 83).toFixed(2)}%, 0)` }
}))

const cssVars = computed(() => {
  const vars: Record<string, string> = {
    '--ease': easing.value,
    '--dur-micro': microDuration.value + 'ms',
    '--dur-flash': (effectiveLevel.value === 0 ? 0 : 1400 * settings.timeScale) + 'ms',
    '--msg-size': settings.textSize + 'px',
    '--bubble-r': settings.bubbleRadius + 'px',
    '--meta-w': settings.timeFormat === '12h' ? '60px' : '40px',
    // Column push (tweb slideNavigation): leaving page parallaxes away and dims.
    '--nav-parallax': settings.mech.navParallax + '%',
    '--nav-dim': String(settings.mech.navDim) + '%'
  }
  for (const item of animationList) {
    vars['--dur-' + item.key] = durationFor(item.key) + 'ms'
    // Displacement collapses to 0 at animation level 1: motions snap, fades stay.
    vars['--dur-' + item.key + '-move'] = moveDurationFor(item.key) + 'ms'
    vars['--ease-' + item.key] = easingFor(item.key)
  }
  // motion-kit bridge: package effects (ripple…) read the same live tokens (tweb reads --ripple-duration back from CSS).
  const rippleFlash = effectiveLevel.value === 1 && settings.animations.ripple && settings.overrides.ripple.duration !== 0
  vars['--mk-ripple-duration'] = (rippleFlash ? 120 : durationFor('ripple')) + 'ms'
  vars['--mk-ripple-easing'] = easingFor('ripple')
  return vars
})

const levelClass = computed(() => effectiveLevel.value === 0 ? 'motion-off' : effectiveLevel.value === 1 ? 'anim-level-1' : '')

/* ------------------------------------------------------------------ helpers */

let toastTimer: ReturnType<typeof setTimeout> | undefined
function notice(value: string) {
  toast.value = value
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}
function vibrate() {
  try { navigator.vibrate?.(8) } catch { /* not supported */ }
}
function findBubble(id: number) {
  return stageRef.value?.querySelector<HTMLElement>(`.message-list .bubble[data-mid="${id}"]`) ?? null
}
function scrollBottom(smooth = false) {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth && durationFor('chat') ? 'smooth' : 'auto' })
}
function isNearBottom() {
  const el = scrollEl.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140
}
function onScroll() {
  const el = scrollEl.value
  if (!el) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  showFab.value = distance > 280
  if (distance < 40) fabUnread.value = 0
}
function quietly(fn: () => void) {
  quiet.value = true
  fn()
  later(() => { quiet.value = false }, 80)
}
function closePopups() {
  mainMenu.value = false
  headerMenu.value = false
  attachMenu.value = false
  showEmoji.value = false
  msgMenu.value = null
}
function replyAuthor(id?: number) {
  const m = messages.value.find(x => x.id === id)
  if (!m) return '已删除的消息'
  return m.mine ? '你' : activeChat.value.name
}
function replyText(id?: number) {
  return messages.value.find(x => x.id === id)?.text ?? '原消息已不可用'
}

/* ------------------------------------------------------------------ folders indicator */

const folderEls: HTMLElement[] = []
const indicator = ref({ x: 0, w: 0 })
function setFolderEl(el: unknown, i: number) {
  if (el instanceof HTMLElement) folderEls[i] = el
}
function measureIndicator() {
  const el = folderEls[folders.findIndex(f => f.key === folder.value)]
  if (el && el.isConnected) indicator.value = { x: el.offsetLeft + 10, w: Math.max(12, el.offsetWidth - 20) }
}
watch(folder, () => { void nextTick(measureIndicator) })

/* ------------------------------------------------------------------ theme */

let themeRequest = 0
async function setTheme(mode: ThemeMode, x = innerWidth - 48, y = 48) {
  const request = ++themeRequest
  const before = resolvedTheme.value
  const after = mode === 'system' ? (system.dark ? 'dark' : 'light') : mode
  const apply = async () => {
    if (request !== themeRequest) return
    settings.theme = mode
    await nextTick()
  }
  const duration = durationFor('themeReveal')
  if (before === after || !duration) { await apply(); return }
  // Night reveal is longer than day (600/500 ms).
  const ms = Math.round(before === 'dark' ? duration * 0.83 : duration)
  await revealFrom({ x, y, duration: ms, easing: easingFor('themeReveal'), apply })
}
function toggleNight(e: MouseEvent) {
  void setTheme(resolvedTheme.value === 'light' ? 'dark' : 'light', e.clientX, e.clientY)
}
watch(resolvedTheme, t => {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#212121' : '#ffffff')
}, { immediate: true })
// Sync the effective animation level for motion-kit effects (ripple degradation).
watch(effectiveLevel, level => { document.documentElement.dataset.motionLevel = String(level) }, { immediate: true })

/* ------------------------------------------------------------------ navigation */

function openSettings(tab: SettingsTab = 'main') {
  closePopups()
  mobileChatOpen.value = false
  if (sidebarView.value === 'settings') { settingsRef.value?.go(tab); return }
  settingsEntry.value = tab
  sidebarDir.value = 'push'
  sidebarView.value = 'settings'
}
function closeSettings() {
  sidebarDir.value = 'pop'
  sidebarView.value = 'chats'
  void nextTick(measureIndicator)
}
function menuButton() {
  if (searching.value) exitSearch()
  else mainMenu.value = !mainMenu.value
}
function exitSearch() {
  query.value = ''
  searchFocused.value = false
  searchInput.value?.blur()
}
function openSearchFromHeader() {
  closePopups()
  if (sidebarView.value === 'settings') closeSettings()
  mobileChatOpen.value = false
  later(() => searchInput.value?.focus(), 30)
}

function changeChat(id: number) {
  if (id === activeId.value) {
    mobileChatOpen.value = true
    return
  }
  const order = sortedChats.value
  chatDir.value = order.findIndex(c => c.id === id) >= order.findIndex(c => c.id === activeId.value) ? 'next' : 'prev'
  cancelFlight()
  pending.clear()
  closePopups()
  activeId.value = id
  visibleCount.value = PAGE
  reply.value = null
  fabUnread.value = 0
  showFab.value = false
  const chat = chats.find(c => c.id === id)
  if (chat) chat.unread = 0
  mobileChatOpen.value = true
  void nextTick(() => scrollBottom())
}

async function loadOlder() {
  const el = scrollEl.value
  quiet.value = true
  // tweb scrollSaver: pin the topmost visible row, then compensate scrollTop after the DOM change.
  if (settings.mech.scrollAnchor && el) {
    scrollSaver.save()
    visibleCount.value += PAGE
    await nextTick()
    scrollSaver.restore()
  } else {
    const oldHeight = el?.scrollHeight ?? 0
    const oldTop = el?.scrollTop ?? 0
    visibleCount.value += PAGE
    await nextTick()
    if (el) el.scrollTop = oldTop + el.scrollHeight - oldHeight
  }
  later(() => { quiet.value = false }, 80)
}

async function jumpTo(id?: number) {
  if (id === undefined) return
  const index = messages.value.findIndex(m => m.id === id)
  if (index < 0) { notice('原消息已被删除'); return }
  const needed = messages.value.length - index
  if (needed > visibleCount.value) {
    quiet.value = true
    if (settings.mech.scrollAnchor && scrollEl.value) {
      scrollSaver.save()
      visibleCount.value = Math.ceil(needed / PAGE) * PAGE
      await nextTick()
      scrollSaver.restore()
    } else {
      const el = scrollEl.value
      const oldHeight = el?.scrollHeight ?? 0
      const oldTop = el?.scrollTop ?? 0
      visibleCount.value = Math.ceil(needed / PAGE) * PAGE
      await nextTick()
      if (el) el.scrollTop = oldTop + el.scrollHeight - oldHeight
    }
    later(() => { quiet.value = false }, 80)
  }
  const row = stageRef.value?.querySelector<HTMLElement>(`.message-list [data-row="${id}"]`)
  row?.scrollIntoView({ block: 'center', behavior: durationFor('chat') ? 'smooth' : 'auto' })
  highlightId.value = null
  await nextTick()
  highlightId.value = id
  later(() => { if (highlightId.value === id) highlightId.value = null }, 1500 * settings.timeScale)
}
function jumpToReply() {
  if (reply.value) void jumpTo(reply.value.id)
}

/* ------------------------------------------------------------------ composer */

function autosize() {
  const el = composer.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 220) + 'px'
}
function onComposerKey(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.isComposing) return
  const ctrl = e.ctrlKey || e.metaKey
  const shouldSend = settings.sendKey === 'enter' ? !e.shiftKey : ctrl
  if (shouldSend) {
    e.preventDefault()
    void send()
  }
}
function insertEmoji(emoji: string) {
  const el = composer.value
  if (!el) { text.value += emoji; return }
  const start = el.selectionStart ?? text.value.length
  const end = el.selectionEnd ?? start
  text.value = text.value.slice(0, start) + emoji + text.value.slice(end)
  void nextTick(() => {
    el.focus()
    const pos = start + emoji.length
    el.setSelectionRange(pos, pos)
    autosize()
  })
}
function toggleEmoji() {
  const open = !showEmoji.value
  closePopups()
  showEmoji.value = open
}
function toggleAttach() {
  const open = !attachMenu.value
  closePopups()
  attachMenu.value = open
}
function startReply(m: Message) {
  reply.value = m
  void nextTick(() => composer.value?.focus())
}
function sendButton() {
  if (canSend.value) void send()
  else notice('按住即可录制语音（演示）')
}

function shiftWallpaper() {
  if (isEnabled('wallpaper')) wallStep.value = (wallStep.value + 1) % wallPositions.length
}

async function send(forced?: string) {
  const content = (forced ?? text.value).trim()
  if (!content) { composer.value?.focus(); return }
  const from = composer.value?.getBoundingClientRect()
  cancelFlight()
  pending.clear()
  const chatId = activeId.value
  const id = ++nextId
  const replyTo = reply.value?.id
  if (!forced) {
    text.value = ''
    void nextTick(autosize)
  }
  closePopups()
  reply.value = null
  const flightMs = durationFor('send')
  if (flightMs && from) pending.add(id)
  data[chatId]?.push({ id, text: content, at: Date.now(), mine: true, replyTo })
  shiftWallpaper()
  await nextTick()
  scrollBottom()
  const target = findBubble(id)
  try {
    if (from && target && flightMs && chatId === activeId.value && stageRef.value) {
      const keep = ['message-row', 'mine', 'group-start', 'group-end']
      const rowClass = [...(target.closest('.message-row')?.classList ?? [])].filter(c => keep.includes(c)).join(' ')
      // tweb sendFlights: the snapshot lands, the real bubble is revealed and the
      // clone cross-fades away (LAND_FADE) instead of blinking in.
      await flyBubble(target, from, stageRef.value, flightMs, settings.mech, () => { pending.delete(id) }, rowClass)
    }
  } finally {
    pending.delete(id)
  }
  if (settings.autoReply) scheduleReply(chatId)
}

function scheduleReply(chatId: number) {
  const chat = chats.find(c => c.id === chatId)
  if (!chat || chat.saved || typing[chatId]) return
  later(() => {
    typing[chatId] = true
    later(() => {
      typing[chatId] = false
      receive(chatId, replies[replyIndex++ % replies.length] ?? '👍')
    }, 1300 + Math.random() * 700)
  }, 450)
}
function receive(chatId: number, content: string): number {
  const list = data[chatId]
  if (!list) return -1
  const id = ++nextId
  const atBottom = isNearBottom()
  list.push({ id, text: content, at: Date.now(), mine: false })
  const chat = chats.find(c => c.id === chatId)
  const visible = chatId === activeId.value && (!isMobile.value || mobileChatOpen.value)
  if (!visible) {
    if (chat) chat.unread++
  } else if (atBottom) {
    void nextTick(() => scrollBottom(true))
  } else {
    fabUnread.value++
  }
  return id
}

/* ------------------------------------------------------------------ message menu, reactions, delete */

const quickReactions = ['👍', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🎉']
const emojiSet = ['😀', '😂', '🥰', '😎', '🤔', '😴', '👍', '👏', '🙏', '💪', '❤️', '💙', '🔥', '✨', '🎉', '🚀', '👀', '💯', '🌈', '☕', '🍰', '🎧', '📌', '✅']
const MENU_W = 256
const MENU_H = 232

function openMsgMenu(id: number, x: number, y: number) {
  closePopups()
  const pad = 8
  let left = x + MENU_W + pad > innerWidth ? x - MENU_W : x
  let top = y + MENU_H + pad > innerHeight ? y - MENU_H : y
  left = Math.min(Math.max(pad, left), innerWidth - MENU_W - pad)
  top = Math.min(Math.max(pad, top), innerHeight - MENU_H - pad)
  const ox = Math.min(Math.max(0, x - left), MENU_W)
  const oy = Math.min(Math.max(0, y - top), MENU_H)
  msgMenu.value = { id, x: left, y: top, origin: `${ox}px ${oy}px` }
}
function onContext(e: MouseEvent, m: Message) {
  openMsgMenu(m.id, e.clientX, e.clientY)
}
function openLastMenu() {
  const last = visibleMessages.value[visibleMessages.value.length - 1]
  const bubble = last ? findBubble(last.id) : null
  if (!last || !bubble) return
  const r = bubble.getBoundingClientRect()
  openMsgMenu(last.id, last.mine ? r.left + 12 : r.right - 12, r.top + r.height / 2)
}
function menuMessage() {
  const id = msgMenu.value?.id
  return messages.value.find(m => m.id === id)
}
function menuAction(kind: 'reply' | 'copy' | 'forward' | 'delete') {
  const m = menuMessage()
  msgMenu.value = null
  if (!m) return
  if (kind === 'reply') startReply(m)
  else if (kind === 'copy') {
    void navigator.clipboard?.writeText(m.text).then(() => notice('已复制到剪贴板'), () => notice('浏览器不允许复制'))
  } else if (kind === 'forward') notice('转发：演示功能')
  else deleteMessage(m.id)
}
function menuReact(emoji: string, e: MouseEvent) {
  const m = menuMessage()
  const from = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (m) void addReaction(m, emoji, from)
}
async function addReaction(m: Message, emoji: string, from?: DOMRect) {
  const removing = m.reaction === emoji
  m.reaction = removing ? undefined : emoji
  msgMenu.value = null
  if (removing) return
  await nextTick()
  const stage = stageRef.value
  const chip = findBubble(m.id)?.querySelector<HTMLElement>('.reaction-chip')
  const icon = chip?.querySelector<HTMLElement>('.reaction-emoji')
  if (!stage || !chip) return
  const d = durationFor('reaction')
  const pop = () => {
    if (icon) icon.style.visibility = ''
    play(chip, [{ transform: 'scale(.55)' }, { transform: 'scale(1.18)', offset: 0.5 }, { transform: 'scale(1)' }], Math.round(d * 0.5), easingFor('reaction'))
    burst(emoji, chip.getBoundingClientRect(), stage, durationFor('particles'))
  }
  // tweb reactionFlight: analytic parabola, the landing chip becomes visible at
  // LANDING_UNTIL while the emoji is still in the air. Level 1 keeps only the pop.
  if (from && d && icon && moveDurationFor('reaction') > 0) {
    icon.style.visibility = 'hidden'
    await flyEmoji(emoji, from, icon.getBoundingClientRect(), stage, d, settings.mech, { key: chip, reveal: pop })
  } else {
    pop()
  }
}
function toggleReaction(m: Message) {
  if (m.reaction) void addReaction(m, m.reaction)
}
function deleteMessage(id: number) {
  const list = data[activeId.value]
  if (!list) return
  const index = list.findIndex(m => m.id === id)
  if (index >= 0) list.splice(index, 1)
  if (reply.value?.id === id) reply.value = null
}
function onMsgLeave(el: Element, done: () => void) {
  const node = el as HTMLElement
  const d = durationFor('incoming')
  if (!d || quiet.value) { done(); return }
  // Level 1 has no displacement and no per-frame layout animation: fade only (tweb spirit).
  if (moveDurationFor('incoming') <= 0) {
    const fade = play(node, [{ opacity: 1 }, { opacity: 0 }], Math.round(d * 0.6), 'ease-out', { fill: 'forwards' })
    if (!fade) { done(); return }
    void settle(fade).then(done)
    return
  }
  node.style.overflow = 'hidden'
  // Every animated property appears in both keyframes (older engines reject partial keyframes).
  const anim = play(node, [
    { height: node.offsetHeight + 'px', marginTop: getComputedStyle(node).marginTop, opacity: 1, transform: 'scale(1)' },
    { height: '0px', marginTop: '0px', opacity: 0, transform: 'scale(.9)' }
  ], d, easingFor('incoming'), { fill: 'forwards' })
  if (!anim) { done(); return }
  void settle(anim).then(done)
}

/* ------------------------------------------------------------------ swipe to reply */

const vReplySwipe = createReplySwipe<Message>({
  onReply: startReply,
  onLongPress: (m, x, y) => { openMsgMenu(m.id, x, y); vibrate() },
  vibrate
})
function onDouble(m: Message) {
  window.getSelection()?.removeAllRanges()
  startReply(m)
}

/* ------------------------------------------------------------------ demos */

async function demoSwipe() {
  const list = visibleMessages.value
  const last = [...list].reverse().find(m => !m.mine) ?? list[list.length - 1]
  if (!last) return
  const bubble = findBubble(last.id)
  const row = bubble?.closest<HTMLElement>('.message-row')
  const d = durationFor('sidebar')
  if (bubble && row && d) {
    row.classList.add('swipe-demo')
    const trigger = swipeTriggerPx()
    const frames: Keyframe[] = [
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(-${trigger + 10}px,0,0)`, offset: 0.4 },
      { transform: `translate3d(-${trigger + 10}px,0,0)`, offset: 0.55 },
      { transform: 'translate3d(0,0,0)' }
    ]
    await settle(play(bubble, frames, Math.round(d * 2.4), easingFor('sidebar')))
    row.classList.remove('swipe-demo')
  }
  startReply(last)
}
async function demoReaction() {
  const last = visibleMessages.value[visibleMessages.value.length - 1]
  if (!last) return
  openLastMenu()
  await nextTick()
  await wait(Math.max(320, durationFor('menu') + 220))
  const button = stageRef.value?.querySelector<HTMLElement>('.msg-menu .quick-reactions button:nth-child(2)')
  await addReaction(last, last.reaction === '❤️' ? '🔥' : '❤️', button?.getBoundingClientRect())
}
async function demoDelete() {
  const id = receive(activeId.value, '这条消息马上会被删除 🗑️')
  await nextTick()
  scrollBottom(true)
  await wait(Math.max(900, durationFor('incoming') + 700))
  deleteMessage(id)
}
function simulateIncoming() {
  const chatId = activeId.value
  typing[chatId] = true
  later(() => {
    typing[chatId] = false
    receive(chatId, replies[replyIndex++ % replies.length] ?? '👋')
  }, 1100)
}
function runStress() {
  const list = data[activeId.value]
  if (!list) return
  const base = Date.now()
  const batch: Message[] = []
  for (let i = 0; i < 500; i++) {
    batch.push({ id: ++nextId, text: `性能测试消息 ${i + 1} · Telegram 风格长消息列表滚动与切换。`, at: base - (500 - i) * 1000, mine: i % 3 === 0 })
  }
  quietly(() => { list.push(...batch) })
  void nextTick(() => scrollBottom())
  notice('已追加 500 条消息 · 页面仅渲染最近 120 条')
}
function runDemo(key: DemoKey) {
  if (isMobile.value) mobileChatOpen.value = true
  if (key === 'send') void send('消息动画：从输入框飞入气泡 ✨')
  else if (key === 'incoming') simulateIncoming()
  else if (key === 'chat') changeChat(activeId.value === 1 ? 2 : 1)
  else if (key === 'menu') openLastMenu()
  else if (key === 'reaction') void demoReaction()
  else if (key === 'swipe') void demoSwipe()
  else if (key === 'delete') void demoDelete()
  else if (key === 'theme') void setTheme(resolvedTheme.value === 'light' ? 'dark' : 'light', innerWidth / 2, innerHeight / 2)
  else if (key === 'stress') runStress()
  else if (key === 'sidebar') openSettings('general')
}

/* ------------------------------------------------------------------ fps meter */

/* ------------------------------------------------------------------ keyboard & lifecycle */

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showAbout.value) showAbout.value = false
    else if (anyPopup.value) closePopups()
    else if (reply.value) reply.value = null
    else if (sidebarView.value === 'settings') settingsRef.value?.back()
    else if (searching.value) exitSearch()
    else if (isMobile.value && mobileChatOpen.value) mobileChatOpen.value = false
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (sidebarView.value === 'settings') closeSettings()
    mobileChatOpen.value = false
    void nextTick(() => searchInput.value?.focus())
  }
}

let stopEnv: (() => void) | undefined
let mobileQuery: MediaQueryList | undefined
const syncMobile = () => { isMobile.value = !!mobileQuery?.matches }
const onResize = () => measureIndicator()

onMounted(() => {
  stopEnv = watchEnvironment()
  mobileQuery = matchMedia('(max-width: 720px)')
  syncMobile()
  mobileQuery.addEventListener('change', syncMobile)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  void nextTick(() => { scrollBottom(); measureIndicator() })
})
onBeforeUnmount(() => {
  stopEnv?.()
  mobileQuery?.removeEventListener('change', syncMobile)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  timers.forEach(t => clearTimeout(t))
  timers.clear()
  if (toastTimer) clearTimeout(toastTimer)
  cancelFlight()
})
</script>

<template>
  <div
    ref="stageRef"
    class="app-shell"
    :class="[`theme-${resolvedTheme}`, levelClass, { 'power-saving': powerSavingActive, 'mobile-chat-open': mobileChatOpen }]"
    :style="cssVars"
  >
    <div class="workspace">
      <!-- ==================== left column ==================== -->
      <aside class="sidebar" aria-label="侧边栏">
        <div class="slider">
          <Transition :name="'tab-' + sidebarDir">
            <div v-if="sidebarView === 'chats'" key="chats" class="tab chats-tab">
              <div class="sidebar-header">
                <button v-ripple class="icon-btn menu-toggle" :class="{ back: searching }" :aria-label="searching ? '退出搜索' : '打开主菜单'" :aria-expanded="mainMenu" @click="menuButton">
                  <Transition name="icon-swap" mode="out-in">
                    <ArrowLeft v-if="searching" key="back" :size="24" />
                    <Menu v-else key="menu" :size="24" />
                  </Transition>
                </button>
                <label class="search">
                  <Search :size="20" />
                  <input ref="searchInput" v-model="query" type="search" placeholder="搜索" aria-label="搜索会话" @focus="searchFocused = true" @blur="searchFocused = false" />
                  <button v-if="query" class="search-clear" aria-label="清空搜索" @mousedown.prevent @click="query = ''"><X :size="16" /></button>
                </label>
                <Transition name="menu-pop">
                  <div v-if="mainMenu" class="btn-menu top-left" role="menu" aria-label="主菜单" @click="mainMenu = false">
                    <button v-ripple class="menu-item" role="menuitem" @click="changeChat(4)"><Bookmark :size="20" /> 收藏夹</button>
                    <button v-ripple class="menu-item" role="menuitem" @click="openSettings('main')"><Settings :size="20" /> 设置</button>
                    <button v-ripple class="menu-item" role="menuitem" @click="openSettings('animations')"><Zap :size="20" /> 动画与省电</button>
                    <button v-ripple class="menu-item" role="menuitem" @click="openSettings('lab')"><FlaskConical :size="20" /> 动效实验室</button>
                    <div class="menu-sep"></div>
                    <button class="menu-item" role="menuitemcheckbox" :aria-checked="resolvedTheme === 'dark'" @click.stop="toggleNight">
                      <Moon :size="20" /> 夜间模式<span class="mini-switch" :class="{ on: resolvedTheme === 'dark' }"></span>
                    </button>
                    <button class="menu-item" role="menuitemcheckbox" :aria-checked="settings.animationLevel > 0" @click.stop="settings.animationLevel = settings.animationLevel > 0 ? 0 : 2">
                      <Sparkles :size="20" /> 动画<span class="mini-switch" :class="{ on: settings.animationLevel > 0 }"></span>
                    </button>
                    <button v-ripple class="menu-item" role="menuitem" @click="showAbout = true"><Info :size="20" /> 关于</button>
                    <div class="menu-footer">Motion Lab 3.0 · 非官方实现</div>
                  </div>
                </Transition>
              </div>

              <div class="folders" role="tablist" aria-label="会话分组">
                <button
                  v-for="(f, i) in folders"
                  :key="f.key"
                  :ref="el => setFolderEl(el, i)"
                  v-ripple
                  class="folder"
                  role="tab"
                  :aria-selected="folder === f.key"
                  :class="{ active: folder === f.key }"
                  @click="folder = f.key"
                >
                  {{ f.label }}<span v-if="f.key === 'unread' && unreadChats" class="folder-badge">{{ unreadChats }}</span>
                </button>
                <span class="folder-indicator" :style="{ transform: `translateX(${indicator.x}px)`, width: indicator.w + 'px' }"></span>
              </div>

              <TransitionGroup tag="nav" name="chat" class="chat-list" aria-label="聊天会话">
                <button
                  v-for="chat in listChats"
                  :key="chat.id"
                  v-ripple
                  class="chat-entry"
                  :class="{ selected: chat.id === activeId && !isMobile }"
                  @click="changeChat(chat.id)"
                >
                  <span class="avatar" :style="{ '--avatar': chat.color }">
                    <Bookmark v-if="chat.saved" :size="24" />
                    <template v-else>{{ chat.avatar }}</template>
                    <span v-if="chat.online" class="online-dot"></span>
                  </span>
                  <span class="chat-info">
                    <span class="chat-line">
                      <b>{{ chat.name }}</b>
                      <small>
                        <CheckCheck v-if="lastOf(chat.id)?.mine" :size="16" class="list-check" />
                        {{ lastOf(chat.id) ? listTime(lastOf(chat.id)!.at) : '' }}
                      </small>
                    </span>
                    <span class="chat-line">
                      <span v-if="typing[chat.id]" class="chat-preview typing-text">正在输入<span class="typing-dots"><i></i><i></i><i></i></span></span>
                      <span v-else class="chat-preview">{{ lastOf(chat.id)?.text ?? '' }}</span>
                      <Transition name="badge"><span v-if="chat.unread" :key="chat.unread" class="unread-badge">{{ chat.unread }}</span></Transition>
                    </span>
                  </span>
                </button>
              </TransitionGroup>
              <p v-if="!listChats.length" class="empty-list">没有匹配的会话</p>
            </div>

            <SettingsPanel
              v-else
              key="settings"
              ref="settingsRef"
              class="tab"
              :entry="settingsEntry"
              @close="closeSettings"
              @demo="runDemo"
              @theme="(mode, x, y) => setTheme(mode, x, y)"
              @about="showAbout = true"
              @toast="notice"
            />
          </Transition>
        </div>
      </aside>

      <!-- ==================== conversation ==================== -->
      <section class="conversation" aria-label="聊天动效演示">
        <div class="chat-wall" aria-hidden="true">
          <span v-for="(b, i) in blobs" :key="i" class="blob" :class="'blob-' + i" :style="b"></span>
          <span class="wall-pattern"></span>
        </div>

        <header class="conversation-head">
          <button v-ripple class="icon-btn mobile-back" aria-label="返回会话列表" @click="mobileChatOpen = false"><ArrowLeft :size="24" /></button>
          <span class="avatar header-avatar" :style="{ '--avatar': activeChat.color }">
            <Bookmark v-if="activeChat.saved" :size="20" />
            <template v-else>{{ activeChat.avatar }}</template>
          </span>
          <div class="head-info">
            <strong>{{ activeChat.name }}</strong>
            <Transition name="status-swap" mode="out-in">
              <span :key="status.text" :class="{ accent: status.accent }">{{ status.text }}<span v-if="status.typing" class="typing-dots"><i></i><i></i><i></i></span></span>
            </Transition>
          </div>
          <div class="head-spacer"></div>
          <button v-ripple class="icon-btn" aria-label="搜索会话" title="搜索 (Ctrl+K)" @click="openSearchFromHeader"><Search :size="22" /></button>
          <a class="icon-btn" href="?workspace=1" aria-label="打开独立动效工作台" title="动效工作台"><FlaskConical :size="22" /></a>
          <button v-ripple class="icon-btn" aria-label="打开动效设置" title="动画与省电" @click="openSettings('animations')"><Settings2 :size="22" /></button>
          <div class="menu-anchor">
            <button v-ripple class="icon-btn" aria-label="更多" :aria-expanded="headerMenu" @click="headerMenu = !headerMenu"><MoreVertical :size="22" /></button>
            <Transition name="menu-pop">
              <div v-if="headerMenu" class="btn-menu top-right" role="menu" aria-label="聊天菜单" @click="headerMenu = false">
                <button v-ripple class="menu-item" role="menuitem" @click="openSettings('animations')"><Settings2 :size="20" /> 动画与省电</button>
                <button v-ripple class="menu-item" role="menuitem" @click="openSettings('lab')"><FlaskConical :size="20" /> 动效实验室</button>
                <button v-ripple class="menu-item" role="menuitem" @click="runDemo('incoming')"><MessageCircle :size="20" /> 模拟收到消息</button>
                <button v-ripple class="menu-item" role="menuitem" @click="runDemo('stress')"><Gauge :size="20" /> 压力测试 (+500)</button>
              </div>
            </Transition>
          </div>
        </header>

        <div class="message-area">
          <Transition :name="'chat-' + chatDir">
            <div :key="activeId" ref="scrollEl" class="message-scroll" @scroll.passive="onScroll">
              <TransitionGroup tag="div" name="msg" class="message-list" :class="{ 'no-enter': quiet }" @leave="onMsgLeave">
                <div v-if="hiddenCount" key="load-older" class="load-older-row">
                  <button v-ripple class="load-older" @click="loadOlder">查看更早的 {{ hiddenCount }} 条消息</button>
                </div>
                <template v-for="row in rows" :key="row.key">
                  <div v-if="row.kind === 'day'" class="day-row"><span>{{ row.label }}</span></div>
                  <div
                    v-else
                    class="message-row"
                    :data-row="row.m.id"
                    :class="{
                      mine: row.m.mine,
                      incoming: !row.m.mine,
                      'group-start': row.start,
                      'group-end': row.end,
                      flying: pending.has(row.m.id),
                      highlight: highlightId === row.m.id,
                      'with-avatar': activeChat.group && !row.m.mine
                    }"
                  >
                    <span v-if="activeChat.group && !row.m.mine" class="mini-avatar" :class="{ hidden: !row.end }" :style="{ '--avatar': activeChat.color }">{{ activeChat.avatar }}</span>
                    <div
                      class="bubble"
                      :class="{ 'has-tail': row.end, 'has-reaction': !!row.m.reaction }"
                      :data-mid="row.m.id"
                      @contextmenu.prevent="onContext($event, row.m)"
                      v-reply-swipe="row.m"
                      @dblclick="onDouble(row.m)"
                    >
                      <div v-if="row.m.replyTo" class="bubble-reply" role="button" tabindex="0" @click.stop="jumpTo(row.m.replyTo)">
                        <b>{{ replyAuthor(row.m.replyTo) }}</b><span>{{ replyText(row.m.replyTo) }}</span>
                      </div>
                      <span class="bubble-text">{{ row.m.text }}</span><span class="meta-spacer"></span>
                      <div v-if="row.m.reaction" class="bubble-reactions">
                        <button class="reaction-chip" :aria-label="'取消回应 ' + row.m.reaction" @click.stop="toggleReaction(row.m)">
                          <span class="reaction-emoji">{{ row.m.reaction }}</span><span class="reaction-count">1</span>
                        </button>
                      </div>
                      <span class="bubble-meta">{{ fmtTime(row.m.at) }}<CheckCheck v-if="row.m.mine" :size="16" class="read-icon" /></span>
                      <svg v-if="row.end" class="bubble-tail" viewBox="0 0 11 20" aria-hidden="true"><path d="M11 0v20H1.6c-1.4 0-2-1.6-1-2.5C5.4 13.6 9.9 8.6 11 0Z" /></svg>
                    </div>
                    <span class="swipe-icon" aria-hidden="true"><Reply :size="18" /></span>
                  </div>
                </template>
              </TransitionGroup>
            </div>
          </Transition>

          <Transition name="fab">
            <button v-if="showFab" class="scroll-fab" aria-label="回到最新消息" @click="scrollBottom(true)">
              <ArrowDown :size="24" />
              <Transition name="badge"><span v-if="fabUnread" :key="fabUnread" class="unread-badge">{{ fabUnread }}</span></Transition>
            </button>
          </Transition>
        </div>

        <div class="composer-zone">
          <div class="composer-row">
            <div class="composer-box">
              <Transition name="collapse">
                <div v-if="reply" class="collapse-body">
                  <div class="collapse-inner"><div class="reply-bar">
                    <Reply class="reply-bar-icon" :size="22" />
                    <div class="reply-bar-text" role="button" tabindex="0" @click="jumpToReply">
                      <b>回复 {{ reply.mine ? '自己' : activeChat.name }}</b><span>{{ reply.text }}</span>
                    </div>
                    <button v-ripple class="icon-btn" aria-label="取消回复" @click="reply = null"><X :size="20" /></button>
                  </div></div>
                </div>
              </Transition>
              <div class="composer-input">
                <button v-ripple class="icon-btn emoji-toggle" :class="{ active: showEmoji }" aria-label="表情" @click="toggleEmoji"><Smile :size="24" /></button>
                <textarea ref="composer" v-model="text" rows="1" placeholder="消息" aria-label="消息内容" @keydown="onComposerKey" @input="autosize"></textarea>
                <button v-ripple class="icon-btn attach-toggle" :class="{ active: attachMenu }" aria-label="附件" @click="toggleAttach"><Paperclip :size="24" /></button>
              </div>
              <Transition name="menu-pop">
                <div v-if="showEmoji" class="emoji-panel" role="dialog" aria-label="表情面板">
                  <button v-for="e in emojiSet" :key="e" class="emoji-cell" :aria-label="e" @click="insertEmoji(e)">{{ e }}</button>
                </div>
              </Transition>
              <Transition name="menu-pop">
                <div v-if="attachMenu" class="btn-menu bottom-right" role="menu" aria-label="附件菜单" @click="attachMenu = false">
                  <button v-ripple class="menu-item" role="menuitem" @click="notice('图片或视频：演示功能')"><ImageIcon :size="20" /> 图片或视频</button>
                  <button v-ripple class="menu-item" role="menuitem" @click="notice('文件：演示功能')"><FileText :size="20" /> 文件</button>
                  <button v-ripple class="menu-item" role="menuitem" @click="notice('投票：演示功能')"><ListChecks :size="20" /> 投票</button>
                </div>
              </Transition>
            </div>
            <button v-ripple class="send-btn" :class="{ ready: canSend }" :aria-label="canSend ? '发送' : '录制语音'" :title="canSend ? '发送' : '语音'" @click="sendButton">
              <Transition name="icon-morph">
                <Send v-if="canSend" key="send" :size="22" />
                <Mic v-else key="mic" :size="24" />
              </Transition>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- ==================== overlays ==================== -->
    <div v-if="anyPopup" class="popup-backdrop" @pointerdown="closePopups" @contextmenu.prevent="closePopups"></div>

    <Transition name="menu-pop">
      <div v-if="msgMenu" class="msg-menu" :style="{ left: msgMenu.x + 'px', top: msgMenu.y + 'px', transformOrigin: msgMenu.origin }">
        <div class="quick-reactions" role="group" aria-label="快速回应">
          <button v-for="e in quickReactions" :key="e" :aria-label="'回应 ' + e" @click="menuReact(e, $event)">{{ e }}</button>
        </div>
        <div class="btn-menu static" role="menu" aria-label="消息菜单">
          <button v-ripple class="menu-item" role="menuitem" @click="menuAction('reply')"><Reply :size="20" /> 回复</button>
          <button v-ripple class="menu-item" role="menuitem" @click="menuAction('copy')"><Copy :size="20" /> 复制文本</button>
          <button v-ripple class="menu-item" role="menuitem" @click="menuAction('forward')"><Forward :size="20" /> 转发</button>
          <button v-ripple class="menu-item danger" role="menuitem" @click="menuAction('delete')"><Trash2 :size="20" /> 删除</button>
        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showAbout" class="modal-overlay" @click="showAbout = false">
        <div class="about-modal" role="dialog" aria-label="关于 Motion Lab" @click.stop>
          <button v-ripple class="icon-btn modal-close" aria-label="关闭" @click="showAbout = false"><X :size="22" /></button>
          <span class="avatar about-logo" style="--avatar:#3390ec"><MessageCircle :size="30" /></span>
          <h2>Telegram Motion Lab</h2>
          <p>独立实现的动效实验室，复刻 Telegram Web 的消息发送、会话切换、菜单、表情回应、滑动回复与设置页交互。与 Telegram 官方无关，不包含其源代码与素材。</p>
          <div class="about-badges"><span>Vue 3</span><span>TypeScript</span><span>WAAPI</span><span>View Transitions</span></div>
          <button v-ripple class="primary-btn" @click="showAbout = false">继续体验</button>
        </div>
      </div>
    </Transition>

    <Transition name="toast"><div v-if="toast" class="toast-msg" role="status">{{ toast }}</div></Transition>

    <div v-if="settings.showFps" class="fps-meter" :class="{ warn: fps < 50 }" aria-live="off">
      <b>{{ fps }}</b> FPS <small>最长帧 {{ worstFrame }} ms</small>
    </div>
  </div>
</template>
