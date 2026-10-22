// 与 yue-cube-app 的语境填空场景/选项结构一致；题目为本地示例。
export interface ContextScene { id: string; scene: string; total: number; icon: string; tone: string }
export interface ContextQuestion {
  id: string
  scenario: string
  stemPre: string
  stemPost: string
  options: { text: string; pronunciation: string }[]
  answerIndex: number
  explanation?: string
}

const scenes: ContextScene[] = [
  { id: 'daily', scene: '日常交流', total: 5, icon: 'chat', tone: 'lavender' },
  { id: 'food', scene: '饮食点餐', total: 5, icon: 'tea', tone: 'green' },
  { id: 'travel', scene: '出行问路', total: 5, icon: 'compass', tone: 'blue' },
  { id: 'shopping', scene: '购物消费', total: 5, icon: 'cart', tone: 'lavender' },
  { id: 'greeting', scene: '问候寒暄', total: 5, icon: 'chat', tone: 'green' },
  { id: 'work', scene: '职场沟通', total: 5, icon: 'desktop', tone: 'blue' },
]
const questions: Record<string, ContextQuestion[]> = {
  daily: [{ id: 'daily-1', scenario: '朋友见面', stemPre: '朋友问你最近点样，你回答：', stemPost: '，多谢关心。', options: [{ text: '几好', pronunciation: 'gei2 hou2' }, { text: '埋单', pronunciation: 'maai4 daan1' }, { text: '行街', pronunciation: 'haang4 gaai1' }, { text: '早唞', pronunciation: 'zou2 tau2' }], answerIndex: 0, explanation: '「几好」表示还不错。' }],
  food: [{ id: 'food-1', scenario: '茶餐厅', stemPre: '食完饭，你向侍应说：', stemPost: '。', options: [{ text: '埋单', pronunciation: 'maai4 daan1' }, { text: '早晨', pronunciation: 'zou2 san4' }, { text: '行街', pronunciation: 'haang4 gaai1' }, { text: '唔使', pronunciation: 'm4 sai2' }], answerIndex: 0, explanation: '「埋单」即结账。' }],
  travel: [{ id: 'travel-1', scenario: '路上问路', stemPre: '想问地铁站在哪里，你说：', stemPost: '？', options: [{ text: '唔该，地铁站喺边度', pronunciation: 'm4 goi1, dei6 tit3 zaam6 hai2 bin1 dou6' }, { text: '我要埋单', pronunciation: 'ngo5 jiu3 maai4 daan1' }, { text: '今日几号', pronunciation: 'gam1 jat6 gei2 hou6' }, { text: '有冇位', pronunciation: 'jau5 mou5 wai2' }], answerIndex: 0, explanation: '「喺边度」表示在哪里。' }],
  shopping: [{ id: 'shopping-1', scenario: '商店购物', stemPre: '想问商品价格，你说：', stemPost: '？', options: [{ text: '呢个几多钱', pronunciation: 'ni1 go3 gei2 do1 cin2' }, { text: '你去边度', pronunciation: 'nei5 heoi3 bin1 dou6' }, { text: '早唞', pronunciation: 'zou2 tau2' }, { text: '得闲饮茶', pronunciation: 'dak1 haan4 jam2 caa4' }], answerIndex: 0, explanation: '「几多钱」表示多少钱。' }],
  greeting: [{ id: 'greeting-1', scenario: '早上见面', stemPre: '早上见到同事，你说：', stemPost: '！', options: [{ text: '早晨', pronunciation: 'zou2 san4' }, { text: '埋单', pronunciation: 'maai4 daan1' }, { text: '落车', pronunciation: 'lok6 ce1' }, { text: '几多钱', pronunciation: 'gei2 do1 cin2' }], answerIndex: 0, explanation: '「早晨」是早上打招呼的常用说法。' }],
  work: [{ id: 'work-1', scenario: '办公室', stemPre: '请同事帮忙，你说：', stemPost: '，帮我睇下呢份文件。', options: [{ text: '唔该', pronunciation: 'm4 goi1' }, { text: '埋单', pronunciation: 'maai4 daan1' }, { text: '早唞', pronunciation: 'zou2 tau2' }, { text: '好耐冇见', pronunciation: 'hou2 noi6 mou5 gin3' }], answerIndex: 0, explanation: '「唔该」可用于请求帮助。' }],
}

// 每个场景补足五道不同的本地示例题，沿用同场景的干扰选项。
const extraQuestionSpecs: Record<string, [string, string, string, string][]> = {
  daily: [
    ['朋友要出门，你提醒佢：', '小心啲', 'siu2 sam1 di1', '「小心啲」表示小心一点。'],
    ['朋友向你道歉，你安慰佢：', '唔紧要', 'm4 gan2 jiu3', '「唔紧要」表示没关系。'],
    ['你想请朋友稍等，说：', '等陣先', 'dang2 zan6 sin1', '「等陣先」表示等一下。'],
    ['朋友帮你搬完重物，你说：', '唔该晒', 'm4 goi1 saai3', '「唔该晒」用于感谢别人的帮助。'],
  ],
  food: [
    ['饮品唔想加冰，你同店员讲：', '走冰', 'zau2 bing1', '「走冰」表示不要加冰。'],
    ['饮品想少放糖，你点单时讲：', '少甜', 'siu2 tim4', '「少甜」表示少放糖。'],
    ['食唔晒，想把剩低嘅食物带走，你讲：', '唔该，打包', 'm4 goi1, daa2 baau1', '「打包」表示把食物装好带走。'],
    ['想要一杯热茶，你点单时讲：', '一杯热茶', 'jat1 bui1 jit6 caa4', '「热茶」即热的茶。'],
  ],
  travel: [
    ['搭巴士准备下车，你提醒司机：', '唔该，有落', 'm4 goi1, jau5 lok6', '「有落」表示有人要下车。'],
    ['想问去目的地仲要几耐，你问：', '仲要几耐', 'zung6 jiu3 gei2 noi6', '「几耐」表示多久。'],
    ['你想问对方系咪要转左，问：', '系咪转左', 'hai6 mai6 zyun3 zo2', '「转左」表示向左转。'],
    ['你唔识去目的地，向路人解释：', '我唔识路', 'ngo5 m4 sik1 lou6', '「唔识路」表示不认识路。'],
  ],
  shopping: [
    ['试衫时发现件衫太细，你问店员：', '有冇大码', 'jau5 mou5 daai6 maa5', '「大码」指更大的尺码。'],
    ['想问可唔可以便宜一点，你讲：', '平啲得唔得', 'peng4 di1 dak1 m4 dak1', '「平啲」表示便宜一点。'],
    ['想先试穿件衫，你问店员：', '可唔可以试着', 'ho2 m4 ho2 ji5 si3 zoek3', '「试着」表示试穿。'],
    ['买完嘢想要袋装住，你讲：', '唔该，畀个袋我', 'm4 goi1, bei2 go3 doi2 ngo5', '「畀个袋我」表示给我一个袋子。'],
  ],
  greeting: [
    ['好耐冇见嘅朋友迎面行来，你讲：', '好耐冇见', 'hou2 noi6 mou5 gin3', '「好耐冇见」表示好久不见。'],
    ['夜晚临瞓前同家人道别，你讲：', '早唞', 'zou2 tau2', '「早唞」是晚安的常用说法。'],
    ['朋友今日生日，你祝佢：', '生日快乐', 'saang1 jat6 faai3 lok6', '「生日快乐」用于生日祝福。'],
    ['想约朋友下次有空再聚，你讲：', '得闲饮茶', 'dak1 haan4 jam2 caa4', '「得闲饮茶」用于邀约，也常用于道别寒暄。'],
  ],
  work: [
    ['开会迟到，你先向同事道歉：', '唔好意思', 'm4 hou2 ji3 si1', '「唔好意思」用于表达歉意。'],
    ['听唔清同事嘅话，你请求佢：', '可唔可以再讲一次', 'ho2 m4 ho2 ji5 zoi3 gong2 jat1 ci3', '「再讲一次」表示再说一遍。'],
    ['完成工作后，你向同事确认：', '我做完喇', 'ngo5 zou6 jyun4 laa3', '「做完喇」表示已经做完了。'],
    ['想问会议几时开始，你讲：', '几时开会', 'gei2 si4 hoi1 wui6', '「几时」表示什么时候。'],
  ],
}
for (const sceneId of Object.keys(extraQuestionSpecs)) {
  const first = questions[sceneId][0]
  extraQuestionSpecs[sceneId].forEach(([stemPre, text, pronunciation, explanation], index) => {
    questions[sceneId].push({
      id: `${sceneId}-${index + 2}`, scenario: first.scenario, stemPre, stemPost: '。',
      options: [{ text, pronunciation }, ...first.options.filter(option => option.text !== text).slice(0, 3)],
      answerIndex: 0, explanation,
    })
  })
}

export async function loadRandomContextScenes(): Promise<ContextScene[]> {
  const shuffled = [...scenes]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled.slice(0, 3)
}
export async function loadContextQuestions(sceneId: string): Promise<ContextQuestion[]> {
  return (questions[sceneId] || []).map(question => {
    const shuffled = question.options.map((option, index) => ({ option, index }))
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
    }
    return { ...question, options: shuffled.map(item => item.option), answerIndex: shuffled.findIndex(item => item.index === question.answerIndex) }
  })
}
