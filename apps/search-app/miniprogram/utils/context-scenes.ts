import request from './http'

export interface ContextScene { id: string; scene: string; total: number; icon: string; tone: string }

const sceneIcons: Record<string, string> = {
  daily: 'chat', food: 'tea', travel: 'compass', shopping: 'cart', campus: 'education',
  leisure: 'music', medical: 'hospital', greeting: 'chat', housing: 'home', commute: 'vehicle',
  sport: 'heart', work: 'desktop', job: 'desktop', stroll: 'cart', bank: 'wallet', weather: 'sunny',
  thanks: 'heart', post: 'send', direction: 'compass', hobby: 'heart', beauty: 'cut',
  communication: 'chat', gathering: 'usergroup', help: 'help-circle', accommodation: 'home',
}
export async function loadRandomContextScenes(): Promise<ContextScene[]> {
  const response = await request<unknown>('/miniprogram/yue_cube_game/question_scenes?mode=context', { auth: false })
  if (!Array.isArray(response)) throw new Error('场景加载失败，请重试')
  const tones = ['lavender', 'green', 'blue']
  const seen = new Set<string>()
  const shuffled: ContextScene[] = response.filter((row): row is { id: string; scene: string; total: number } => {
    if (!row || typeof row.id !== 'string' || !row.id || typeof row.scene !== 'string' || !row.scene.trim() || typeof row.total !== 'number' || row.total <= 0 || seen.has(row.id)) return false
    seen.add(row.id)
    return true
  }).map(row => ({ ...row, icon: sceneIcons[row.id] || 'chat', tone: '' }))
  if (!shuffled.length) throw new Error('暂无可用场景')
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled.slice(0, 3).map((scene, index) => ({ ...scene, tone: tones[index] }))
}
