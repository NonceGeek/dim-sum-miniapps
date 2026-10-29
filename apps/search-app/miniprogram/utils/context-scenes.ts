import request from './http'
import { API } from '../config/api'

export interface ContextScene { id: string; scene: string; total: number; icon: string; tone: string }

const sceneIcons: Record<string, string> = {
  daily: 'chat', food: 'tea', travel: 'compass', shopping: 'cart', campus: 'education',
  leisure: 'music', medical: 'hospital', greeting: 'chat', housing: 'home', commute: 'vehicle',
  sport: 'heart', work: 'desktop', job: 'desktop', stroll: 'cart', bank: 'wallet', weather: 'sunny',
  thanks: 'heart', post: 'send', direction: 'compass', hobby: 'heart', beauty: 'cut',
  communication: 'chat', gathering: 'usergroup', help: 'help-circle', accommodation: 'home',
}
type SceneRow = { id: string; scene: string; total: number }
const cacheKey = `search-app:context-scenes:${encodeURIComponent(API.baseUrl)}:${wx.getAccountInfoSync().miniProgram.envVersion}`
let pending: Promise<SceneRow[]> | null = null
function validRows(value: unknown): SceneRow[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.filter((row): row is SceneRow => {
    if (!row || typeof row.id !== 'string' || !row.id || typeof row.scene !== 'string' || !row.scene.trim() || !Number.isFinite(row.total) || row.total <= 0 || seen.has(row.id)) return false
    seen.add(row.id); return true
  }).map(({ id, scene, total }) => ({ id, scene, total }))
}
async function loadScenes(): Promise<SceneRow[]> {
  let stale: SceneRow[] = []
  try {
    const cache = wx.getStorageSync(cacheKey)
    stale = validRows(cache?.rows)
    const age = Date.now() - cache?.savedAt
    if (stale.length && Number.isFinite(age) && age >= 0 && age < 86400000) return stale
  } catch (_) {}
  try {
    const rows = validRows(await request<unknown>('/yue_cube_game/question_scenes?mode=context', { auth: false }))
    if (!rows.length) throw new Error('暂无可用场景')
    try { wx.setStorageSync(cacheKey, { rows, savedAt: Date.now() }) } catch (_) {}
    return rows
  } catch (error) {
    if (stale.length) return stale
    throw error
  }
}
export async function loadRandomContextScenes(): Promise<ContextScene[]> {
  if (!pending) pending = loadScenes().finally(() => { pending = null })
  const response = await pending
  const tones = ['lavender', 'green', 'blue']
  const shuffled: ContextScene[] = response.map(row => ({ ...row, icon: sceneIcons[row.id] || 'chat', tone: '' }))
  if (!shuffled.length) throw new Error('暂无可用场景')
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled.slice(0, 3).map((scene, index) => ({ ...scene, tone: tones[index] }))
}
