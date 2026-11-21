<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Menu, Search, Info, MoreVertical, Send, Smile, Paperclip, X, Reply, Copy, Heart, Settings2, Moon, Sun, CheckCheck, Zap, ArrowLeftRight, MessageCircle, MousePointerClick } from 'lucide-vue-next'
import { cancelFlight, flyText, motionPresets, systemReducedMotion, type MotionPreset } from './motion'

type Message = { id: number; text: string; time: string; mine: boolean; reaction?: string }
type Chat = { id: number; name: string; handle: string; avatar: string; color: string; preview: string; time: string; online?: boolean }
const chats: Chat[] = [
  {id:1,name:'Motion Design',handle:'动效研究小组',avatar:'✦',color:'#2d90b5',preview:'丝滑感来自细节和反馈',time:'现在',online:true},
  {id:2,name:'Alex Chen',handle:'设计师 · 在线',avatar:'AC',color:'#a174ce',preview:'你试过这个动画曲线吗？',time:'14:28',online:true},
  {id:3,name:'Product Team',handle:'产品讨论',avatar:'PT',color:'#4b9476',preview:'新的视觉稿已经准备好了',time:'昨天'},
  {id:4,name:'Motion Notes',handle:'我的收藏',avatar:'◇',color:'#c08b5a',preview:'Spring 和 Easing 的区别',time:'周三'},
  {id:5,name:'UI Inspiration',handle:'设计灵感',avatar:'UI',color:'#7989d4',preview:'试试看共享元素转场',time:'周二'}
]
const data = reactive<Record<number, Message[]>>({
  1: [
    {id:11,text:'欢迎来到 Motion Lab！这里是 Telegram 风格的微交互实验室。',time:'14:20',mine:false},
    {id:12,text:'我想研究一下，为什么 Telegram 的动画看起来这么自然？',time:'14:21',mine:true},
    {id:13,text:'秘诀不只是缓动曲线，更是连续的反馈、可中断的状态和精确的时间安排。',time:'14:22',mine:false},
    {id:14,text:'试试发送消息、切换会话、长按气泡和向右滑动回复。',time:'14:23',mine:false,reaction:'✨'},
    {id:15,text:'这就是我想要的丝滑感！',time:'14:24',mine:true,reaction:'💙'}
  ],
  2: [
    {id:21,text:'嗨！刚研究了几组不错的缓动参数。',time:'14:25',mine:false},
    {id:22,text:'cubic-bezier(.23, 1, .32, 1) 在快速界面过渡中效果很好。',time:'14:26',mine:false},
    {id:23,text:'我去试试。',time:'14:28',mine:true}
  ],
  3: [{id:31,text:'页面切换应该保持上下文，而不是突然跳到新界面。',time:'11:10',mine:false},{id:32,text:'同意，我们先实现高质量的基础动画。',time:'11:12',mine:true}],
  4: [{id:41,text:'动效原则：及时、连续、克制、可预测。',time:'09:40',mine:false}],
  5: [{id:51,text:'越快的响应，不代表越短的每一个动画。',time:'08:30',mine:false}]
})
const activeId = ref(1)
const activeChat = computed(() => chats.find(c => c.id === activeId.value) ?? chats[0]!)
const messages = computed(() => data[activeId.value] ?? [])
const visibleCount = ref(120)
const visibleMessages = computed(() => messages.value.slice(-visibleCount.value))
const hiddenMessageCount = computed(() => Math.max(0, messages.value.length - visibleCount.value))
async function loadOlderMessages() {
  const el = scrollEl.value
  const oldHeight = el?.scrollHeight ?? 0
  const oldTop = el?.scrollTop ?? 0
  visibleCount.value += 120
  await nextTick()
  if (el) el.scrollTop = oldTop + el.scrollHeight - oldHeight
}
const query = ref('')
const filtered = computed(() => chats.filter(c => (c.name + c.handle + c.preview).toLowerCase().includes(query.value.toLowerCase())))
const text = ref('')
const preset = ref<MotionPreset>('telegram')
const duration = ref(320)
const reduce = ref(false)
const lowPower = ref(false)
const osReduced = ref(false)
const compact = ref(false)
const theme = ref<'light' | 'dark'>('light')
function setTheme(value: 'light' | 'dark') {
  theme.value = value
  try { localStorage.setItem('motion-lab-theme', value) } catch { /* Storage may be disabled */ }
}
function toggleTheme() { setTheme(theme.value === 'light' ? 'dark' : 'light') }
const inspectorOpen = ref(false)
const mobileChats = ref(false)
const showEmoji = ref(false)
const showAbout = ref(false)
const reply = ref<Message | null>(null)
const pending = reactive(new Set<number>())
const activeDemo = ref('send')
const composer = ref<HTMLTextAreaElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const menu = ref<{ id: number; x: number; y: number; originX: number; originY: number } | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
let nextId = 100
let media: MediaQueryList | undefined
let touchTimer: ReturnType<typeof setTimeout> | undefined
let swipe: { id: number; pointer: number; x: number; y: number; dx: number; el: HTMLElement; axis: 'pending'|'horizontal'|'vertical' } | null = null
const easing = computed(() => motionPresets[preset.value].ease)
const reduced = computed(() => reduce.value || osReduced.value)
const ms = computed(() => reduced.value ? 0 : lowPower.value ? Math.round(duration.value * .6) : duration.value)
const vars = computed(() => ({ '--duration': ms.value + 'ms', '--fast': Math.round(ms.value * .62) + 'ms', '--ease': easing.value }))
const now = () => new Intl.DateTimeFormat('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date())
function notice(value: string) {
  toast.value = value
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.value = '', 2400)
}
function scrollBottom() {
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}
function changeChat(id: number) {
  if (id === activeId.value) return
  cancelFlight()
  pending.clear()
  activeId.value = id
  visibleCount.value = 120
  mobileChats.value = false
  menu.value = null
  showEmoji.value = false
  reply.value = null
  activeDemo.value = 'page'
  void nextTick(scrollBottom)
}
async function send(forced?: string) {
  const content = (forced ?? text.value).trim()
  if (!content) { composer.value?.focus(); return }
  const from = composer.value?.getBoundingClientRect()
  cancelFlight()
  pending.clear()
  const chatId = activeId.value
  const id = ++nextId
  if (!forced) text.value = ''
  showEmoji.value = false
  reply.value = null
  if (ms.value && from) pending.add(id)
  data[chatId]?.push({ id, text: content, time: now(), mine: true })
  await nextTick()
  scrollBottom()
  await nextTick()
  const target = document.querySelector<HTMLElement>('.bubble[data-mid="' + id + '"]')
  try {
    if (from && target && ms.value && chatId === activeId.value) {
      const styles = getComputedStyle(target)
      await flyText(content, from, target.getBoundingClientRect(), ms.value, easing.value, styles.backgroundColor, styles.color)
    }
  } finally {
    pending.delete(id)
  }
  activeDemo.value = 'send'
}
function onComposerKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void send()
  }
}
function openMenuByRect(id: number, r: DOMRect) {
  // Keep the anchor point inside the viewport, including near its edges.
  const width = 232, height = 210, inset = 12
  const x = Math.max(inset, Math.min(window.innerWidth - width - inset, r.right - width + 12))
  const y = Math.max(inset, Math.min(window.innerHeight - height - inset, r.top))
  menu.value = {
    id, x, y,
    originX: Math.max(0, Math.min(width, r.right - x - 12)),
    originY: Math.max(0, Math.min(height, r.top + Math.min(24, r.height / 2) - y))
  }
  activeDemo.value = 'popover'
}
function openMenu(e: Event, m: Message) {
  e.preventDefault()
  e.stopPropagation()
  const root = (e.currentTarget as HTMLElement).closest('.message-row')
  const bubble = (e.currentTarget as HTMLElement).closest('.bubble') ?? root?.querySelector('.bubble')
  if (bubble) openMenuByRect(m.id, bubble.getBoundingClientRect())
}
function lastMenu() {
  const last = messages.value[messages.value.length - 1]
  if (!last) return
  const el = document.querySelector<HTMLElement>('.bubble[data-mid="' + last.id + '"]')
  if (el) openMenuByRect(last.id, el.getBoundingClientRect())
}
function addReaction(m: Message, emoji = '💙') {
  m.reaction = m.reaction === emoji ? undefined : emoji
  menu.value = null
  activeDemo.value = 'reaction'
  void nextTick(() => {
    const node = document.querySelector<HTMLElement>('.bubble[data-mid="' + m.id + '"] .reaction-chip')
    if (node && ms.value) {
      node.animate([{transform:'scale(.5)',opacity:.1},{transform:'scale(1.25)',opacity:1,offset:.64},{transform:'scale(1)',opacity:1}], {duration:ms.value,easing:easing.value})
      if (!lowPower.value) {
        const box = node.getBoundingClientRect()
        for (let i = 0; i < 4; i++) {
          const particle = document.createElement('span')
          particle.className = 'particle'
          particle.textContent = emoji
          particle.style.left = box.left + box.width / 2 + 'px'
          particle.style.top = box.top + 'px'
          document.body.append(particle)
          void particle.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:'translate(' + ((i - 1.5) * 29) + 'px,-48px) scale(1)',opacity:0}], {duration:480,easing:'ease-out'}).finished.catch(() => {}).finally(() => particle.remove())
        }
      }
    }
  })
}
function doMenu(kind: 'copy' | 'reply' | 'react', emoji?: string) {
  const id = menu.value?.id
  menu.value = null
  const m = messages.value.find(m => m.id === id)
  if (!m) return
  if (kind === 'react') addReaction(m, emoji)
  if (kind === 'reply') { reply.value = m; composer.value?.focus() }
  if (kind === 'copy') {
    void navigator.clipboard.writeText(m.text).then(() => notice('已复制到剪贴板')).catch(() => notice('浏览器不允许复制'))
  }
}
function lastReact() {
  const last = messages.value[messages.value.length - 1]
  if (last) addReaction(last, last.reaction === '💙' ? '✨' : '💙')
}
function startSwipe(e: PointerEvent, m: Message) {
  if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
  const el = e.currentTarget as HTMLElement
  swipe = { id:m.id, pointer:e.pointerId, x:e.clientX, y:e.clientY, dx:0, el, axis:'pending' }
  if (touchTimer) clearTimeout(touchTimer)
  if (e.pointerType !== 'mouse') touchTimer = setTimeout(() => {
    if (swipe?.id === m.id && swipe.axis === 'pending') {
      openMenuByRect(m.id, el.getBoundingClientRect())
      swipe = null
    }
  }, 520)
}
function moveSwipe(e: PointerEvent) {
  if (!swipe || swipe.pointer !== e.pointerId) return
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y
  if (Math.hypot(dx,dy) > 9) {
    if (touchTimer) clearTimeout(touchTimer)
    if (swipe.axis === 'pending') swipe.axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'horizontal' : 'vertical'
  }
  if (swipe.axis !== 'horizontal' || dx <= 0) return
  // Rubber-band resistance after the trigger distance.
  const offset = dx < 62 ? dx : 62 + (dx - 62) * .22
  swipe.dx = Math.min(98, offset)
  swipe.el.getAnimations().forEach(a => a.cancel())
  swipe.el.style.transform = `translate3d(${swipe.dx}px,0,0)`
  swipe.el.style.transition = 'none'
}
function endSwipe(e: PointerEvent, m: Message) {
  if (touchTimer) clearTimeout(touchTimer)
  if (!swipe || swipe.id !== m.id || swipe.pointer !== e.pointerId) return
  const state = swipe
  swipe = null
  const distance = state.dx
  state.el.style.transition = 'none'
  state.el.style.transform = ''
  if (distance && ms.value) {
    state.el.animate([
      {transform:`translate3d(${distance}px,0,0)`},
      {transform:'translate3d(-3px,0,0)',offset:.78},
      {transform:'translate3d(0,0,0)'}
    ],{duration:Math.min(440,Math.max(180,ms.value)),easing:'cubic-bezier(.2,.8,.2,1)'})
  }
  if (e.type !== 'pointercancel' && distance > 54) {
    reply.value = m
    activeDemo.value = 'swipe'
    composer.value?.focus()
  }
}
function runDemo(key: string) {
  activeDemo.value = key
  if (key === 'send') void send('消息动画：从输入框到聊天气泡 ✨')
  else if (key === 'page') changeChat(activeId.value === 1 ? 2 : 1)
  else if (key === 'popover') lastMenu()
  else if (key === 'reaction') lastReact()
  else if (key === 'swipe') {
    const m = messages.value[messages.value.length - 1]
    if (m) { reply.value = m; composer.value?.focus(); notice('也可以右滑任意消息回复') }
  }
  else if (key === 'stress') runStressDemo()
  else if (key === 'micro') { notice('这是一个轻量微交互反馈 ✨'); compact.value = !compact.value }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { menu.value = null; showEmoji.value = false; showAbout.value = false; inspectorOpen.value = false }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); mobileChats.value = true; void nextTick(() => searchInput.value?.focus()) }
}
const onMediaChange = (e: MediaQueryListEvent) => { osReduced.value = e.matches }
onMounted(() => {
  try {
    const saved = localStorage.getItem('motion-lab-theme')
    if (saved === 'light' || saved === 'dark') theme.value = saved
  } catch { /* Storage may be disabled */ }
  media = matchMedia('(prefers-reduced-motion: reduce)')
  osReduced.value = systemReducedMotion()
  media.addEventListener('change', onMediaChange)
  document.addEventListener('keydown', onKey)
  nextTick(scrollBottom)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  media?.removeEventListener('change', onMediaChange)
  if (touchTimer) clearTimeout(touchTimer)
  if (toastTimer) clearTimeout(toastTimer)
  cancelFlight()
})
function runStressDemo() {
  // DOM stays bounded by visibleMessages while the store exercises heavy histories.
  const chat = data[activeId.value]
  if (!chat) return
  for (let index = 0; index < 500; index++) {
    chat.push({ id: ++nextId, text: `性能测试消息 ${index + 1} · Telegram 风格长消息列表滚动与切换。`, time: now(), mine: index % 3 === 0 })
  }
  void nextTick(scrollBottom)
  notice('已生成 500 条消息 · 页面仅渲染最近 120 条')
}
const demos = [
  {key:'send',icon:Send,title:'消息飞入',desc:'输入框 → 气泡'},
  {key:'page',icon:ArrowLeftRight,title:'页面转场',desc:'连续切换'},
  {key:'popover',icon:MousePointerClick,title:'弹出菜单',desc:'锚点缩放'},
  {key:'reaction',icon:Heart,title:'表情反馈',desc:'弹性微交互'},
  {key:'swipe',icon:Reply,title:'手势回复',desc:'跟手与回弹'},
  {key:'micro',icon:Zap,title:'微交互',desc:'即时状态反馈'},
  {key:'stress',icon:Zap,title:'压力测试',desc:'追加 500 条消息'}
]
</script>

<template>
  <div ref="stageRef" class="app-shell" :class="{ compact, 'reduce-animations': reduced, 'theme-light':theme === 'light', 'theme-dark':theme === 'dark', 'inspector-hidden':!inspectorOpen }" :style="vars">
    <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div>
    <div class="app-frame">
      <div class="workspace">
        <aside class="sidebar" :class="{ 'mobile-open': mobileChats }">
          <div class="side-heading">
            <button class="icon-btn side-menu-button" aria-label="打开动效设置" title="动效设置" @click="inspectorOpen = true"><Menu :size="24"/></button>
            <span class="side-title">Chats</span>
            <span class="count">{{ chats.length }}</span>
          </div>
          <label class="search"><Search :size="19" /><input ref="searchInput" v-model="query" type="search" placeholder="Search" aria-label="搜索会话" /></label>

          <nav class="chat-list" aria-label="聊天会话">
            <button v-for="chat in filtered" :key="chat.id" class="chat-entry" :class="{ selected: chat.id === activeId }" @click="changeChat(chat.id)">
              <span class="avatar" :style="{ background: chat.color }">{{ chat.avatar }}</span>
              <span class="chat-info"><span class="chat-line"><b>{{ chat.name }}</b><small>{{ chat.time }}</small></span><span class="chat-preview">{{ chat.preview }}</span></span>
            </button>
          </nav>
          
        </aside>

        <section class="conversation" aria-label="聊天动效演示">
          <div class="conversation-head">
            <button class="icon-btn mobile-back" aria-label="打开会话列表" @click="mobileChats = !mobileChats"><Menu :size="22"/></button>
            <span class="avatar header-avatar" :style="{ background: activeChat.color }">{{ activeChat.avatar }}</span>
            <div class="head-info"><strong>{{ activeChat.name }}</strong><span>{{ activeChat.online ? 'online' : activeChat.handle }}</span></div>
            
            <div class="head-spacer"></div>
            <button class="icon-btn" title="搜索会话" @click="mobileChats = true; nextTick(() => searchInput?.focus())"><Search :size="21"/></button>
            <button class="icon-btn" aria-label="打开动效设置" title="动效设置" @click="inspectorOpen = true"><Settings2 :size="21"/></button>
            <button class="icon-btn" title="消息菜单" @click="lastMenu"><MoreVertical :size="21"/></button>
          </div>
          <div class="chat-wall">
            <Transition name="chat-swap">
              <div :key="activeId" ref="scrollEl" class="message-scroll">
                <button v-if="hiddenMessageCount" class="load-older" @click="loadOlderMessages">查看更早的 {{ hiddenMessageCount }} 条消息</button>
                <div class="day-label"><span>今天</span></div>
                <div v-for="m in visibleMessages" :key="m.id" class="message-row" :class="{ mine:m.mine, incoming:!m.mine }">
                  <div v-if="!m.mine" class="mini-avatar" :style="{ background: activeChat.color }">{{ activeChat.avatar }}</div>
                  <div class="bubble" :class="{ 'is-pending': pending.has(m.id) }" :data-mid="m.id" @contextmenu="openMenu($event, m)" @pointerdown="startSwipe($event as PointerEvent, m)" @pointermove="moveSwipe($event as PointerEvent)" @pointerup="endSwipe($event as PointerEvent, m)" @pointercancel="endSwipe($event as PointerEvent, m)">
                    <span class="bubble-text">{{ m.text }}</span>
                    <span class="bubble-bottom"><span>{{ m.time }}</span><CheckCheck v-if="m.mine" class="read-icon" :size="15"/></span>
                    <button v-if="m.reaction" class="reaction-chip" :aria-label="'反应 '+m.reaction" @click="addReaction(m, m.reaction)">{{ m.reaction }}</button>
                  </div>
                  <button class="message-more" title="更多选项" @click="openMenu($event, m)"><MoreVertical :size="18"/></button>
                </div>
              </div>
            </Transition>
          </div>
          <div class="composer-zone">
            <Transition name="fade-up">
              <div v-if="reply" class="reply-preview"><span class="reply-mark"></span><div><b>回复消息</b><span>{{ reply.text }}</span></div><button class="icon-btn" @click="reply = null" aria-label="取消回复"><X :size="18"/></button></div>
            </Transition>
            <Transition name="fade-up"><div v-if="showEmoji" class="emoji-picker"><button v-for="e in ['😀','💙','🔥','✨','🎉','👍','🤔','😍','🚀']" :key="e" @click="text += e; showEmoji = false; composer?.focus()">{{ e }}</button></div></Transition>
            <div class="composer">
              <button class="icon-btn attachment" title="选择表情" @click="showEmoji = !showEmoji"><Paperclip :size="22"/></button>
              <textarea ref="composer" v-model="text" rows="1" placeholder="Message" aria-label="消息内容" @keydown="onComposerKey"></textarea>
              <button class="icon-btn emoji-toggle" title="表情" @click="showEmoji = !showEmoji"><Smile :size="22"/></button>
              <button class="send-btn" title="发送" :disabled="!text.trim()" @click="send()"><Send :size="20" fill="currentColor" :stroke-width="1.8"/></button>
            </div>

          </div>
        </section>

        <div v-if="inspectorOpen" class="inspector-scrim" @click="inspectorOpen = false"></div>
        <aside v-if="inspectorOpen" class="inspector" aria-label="动效实验设置">
          <div class="inspector-toolbar">
            <button class="icon-btn" aria-label="关闭动效设置" title="关闭" @click="inspectorOpen = false"><X :size="22"/></button>
            <strong>Settings</strong>
            <button class="icon-btn" :title="theme === 'light' ? '切换深色主题' : '切换浅色主题'" @click="toggleTheme"><Moon v-if="theme==='light'" :size="21"/><Sun v-else :size="21"/></button>
            <button class="icon-btn" title="关于此项目" @click="showAbout = true"><Info :size="21"/></button>
          </div>
          <div class="inspector-heading"><span>Motion Lab</span></div>
          
          <div class="inspector-section"><span class="section-label">交互演示</span>
            <div class="demo-grid">
              <button v-for="d in demos" :key="d.key" class="demo-tile" :class="{ active:activeDemo === d.key }" @click="runDemo(d.key)"><span class="demo-icon"><component :is="d.icon" :size="21" :stroke-width="1.9"/></span><strong>{{ d.title }}</strong><small>{{ d.desc }}</small></button>
            </div>
          </div>
          <div class="inspector-section settings-section">
            <div class="theme-setting">
              <span class="field-label">外观主题</span>
              <div class="theme-options" role="group" aria-label="外观主题">
                <button :aria-pressed="theme === 'light'" :class="{ chosen:theme==='light' }" @click="setTheme('light')"><Sun :size="17"/> 浅色</button>
                <button :aria-pressed="theme === 'dark'" :class="{ chosen:theme==='dark' }" @click="setTheme('dark')"><Moon :size="17"/> 深色</button>
              </div>
            </div>
            <div class="section-title"><span>动效参数</span><span class="section-gear"><Settings2 :size="19"/></span></div>
            <label class="field-label">缓动曲线 <span>{{ motionPresets[preset].label }}</span></label>
            <div class="preset-options"><button v-for="(option,key) in motionPresets" :key="key" :class="{ chosen:preset === key }" @click="preset = key">{{ option.label }}</button></div>
            <div class="curve-box">
              <svg viewBox="0 0 260 102" preserveAspectRatio="none" aria-label="缓动曲线示意">
                <path d="M 12 90 L 248 12" stroke="#637b94" stroke-dasharray="3 5" fill="none" opacity=".5"/>
                <path d="M12 90 C 52 20, 80 12, 248 12" stroke="#43c5eb" stroke-width="3" fill="none" stroke-linecap="round"/>
                <circle cx="248" cy="12" r="4" fill="#43c5eb"/>
              </svg>
              <span>{{ motionPresets[preset].description }}</span>
            </div>
            <label class="field-label duration-label" for="speed">动画时长 <span>{{ duration }} ms</span></label>
            <input id="speed" v-model.number="duration" class="range-input" type="range" min="120" max="650" step="10"/>
            <div class="range-labels"><span>120 ms · 快速</span><span>650 ms · 柔和</span></div>
            <label class="toggle-line"><span><b>减少动态效果</b><small>关闭非必要运动</small></span><input v-model="reduce" type="checkbox" role="switch"/><span class="toggle-track"></span></label>
            <label class="toggle-line"><span><b>低功耗模式</b><small>缩短动画、减少粒子</small></span><input v-model="lowPower" type="checkbox" role="switch"/><span class="toggle-track"></span></label>
          </div>
          
        </aside>
      </div>

    </div>

    <div v-if="menu" class="menu-overlay" @click="menu = null" @contextmenu.prevent="menu = null">
      <div class="context-menu" :style="{ left:menu.x+'px', top:menu.y+'px', '--menu-origin': menu.originX+'px '+menu.originY+'px' }" role="menu" @click.stop>
        <div class="quick-reactions"><button v-for="e in ['👍','❤️','😂','🔥','✨','💙']" :key="e" :title="'回应 '+e" @click="doMenu('react',e)">{{ e }}</button></div>
        <div class="menu-separator"></div>
        <button @click="doMenu('reply')"><Reply :size="19"/> 回复消息</button>
        <button @click="doMenu('copy')"><Copy :size="19"/> 复制文本</button>
        <button @click="doMenu('react','💙')"><Heart :size="19"/> 快速点赞</button>
      </div>
    </div>
    <div v-if="showAbout" class="modal-overlay" @click="showAbout=false"><div class="about-modal" @click.stop><button class="modal-close" @click="showAbout=false" aria-label="关闭"><X :size="22"/></button><span class="brand-symbol"><MessageCircle :size="21"/></span><h2>Telegram Motion Lab</h2><p>独立制作的动效实验室，展示真实的发送、切换、菜单、表情与手势交互。此项目不属于 Telegram 官方。</p><div class="about-badges"><span>Vue 3</span><span>TypeScript</span><span>WAAPI</span><span>Vite 7</span></div><button class="about-done" @click="showAbout=false">继续体验</button></div></div>
    <Transition name="toast"><div v-if="toast" class="toast-msg">{{ toast }}</div></Transition>
  </div>
</template>
