import { reactive } from 'vue'
export type Message = { id: number; text: string; at: number; mine: boolean; reaction?: string; replyTo?: number }
export type Chat = { id: number; name: string; avatar: string; color: string; status: string; unread: number; group?: boolean; online?: boolean; saved?: boolean; pinned?: boolean }

export const MIN = 60_000
const DAY_MIN = 1440
export const PAGE = 120
export function createChatData() {
const boot = Date.now()
const ago = (minutes: number) => boot - minutes * MIN

const chats = reactive<Chat[]>([
  { id: 1, name: 'Motion Design', avatar: 'MD', color: '#5caffa', status: '128 位成员', unread: 0, group: true, pinned: true },
  { id: 2, name: 'Alex Chen', avatar: 'AC', color: '#a695e7', status: '最近在线', unread: 0, online: true },
  { id: 3, name: 'Product Team', avatar: 'PT', color: '#7bc862', status: '12 位成员', unread: 2, group: true },
  { id: 4, name: '收藏夹', avatar: '', color: '#3390ec', status: '收藏的消息', unread: 0, saved: true },
  { id: 5, name: 'UI Inspiration', avatar: 'UI', color: '#ee7aae', status: '最近在线', unread: 1 }
])

const data = reactive<Record<number, Message[]>>({
  1: [
    { id: 10, text: '昨天的结论：动效要服务于理解，而不是装饰。', at: ago(DAY_MIN + 95), mine: false },
    { id: 11, text: '欢迎来到 Motion Lab！这里复刻了 Telegram 的微交互。', at: ago(18), mine: false },
    { id: 12, text: '为什么 Telegram 的动画看起来这么自然？', at: ago(16), mine: true },
    { id: 13, text: '秘诀不只是缓动曲线，更是连续的反馈、可中断的状态和精确的时间安排。', at: ago(15), mine: false },
    { id: 14, text: '试试发送消息、右键气泡、向左滑动回复，或者双击气泡。', at: ago(15), mine: false, reaction: '🔥' },
    { id: 15, text: '这就是我想要的丝滑感！', at: ago(12), mine: true, reaction: '❤️', replyTo: 13 }
  ],
  2: [
    { id: 21, text: '嗨！刚调了几组不错的缓动参数。', at: ago(44), mine: false },
    { id: 22, text: 'cubic-bezier(.23, 1, .32, 1) 在快速界面过渡中效果很好。', at: ago(43), mine: false },
    { id: 23, text: '我去设置里对比一下 👀', at: ago(40), mine: true }
  ],
  3: [
    { id: 31, text: '页面切换应该保持上下文，而不是突然跳到新界面。', at: ago(DAY_MIN + 180), mine: false },
    { id: 32, text: '同意，我们先把基础动画做扎实。', at: ago(DAY_MIN + 176), mine: true },
    { id: 33, text: '新的视觉稿已经准备好了。', at: ago(DAY_MIN + 20), mine: false },
    { id: 34, text: '今晚一起过一遍？', at: ago(DAY_MIN + 19), mine: false }
  ],
  4: [{ id: 41, text: '动效原则：及时、连续、克制、可预测。', at: ago(3 * DAY_MIN), mine: true }],
  5: [{ id: 51, text: '越快的响应，不代表越短的每一个动画。', at: ago(5 * DAY_MIN), mine: false }]
})

return { chats, data }
}
