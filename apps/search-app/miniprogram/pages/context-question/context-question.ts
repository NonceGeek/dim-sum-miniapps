import { applyAppearance } from '../../utils/appearance'
import { loadContextQuestions, type ContextQuestion } from '../../utils/context-game'
import { showCommonDialog } from '@dim-sum/common-dialog'

Page({
  countdownTimer: undefined as ReturnType<typeof setInterval> | undefined,
  data: {
    optionLetters: ['A', 'B', 'C', 'D'],
    secondsLeft: 15,
    progressPercent: 0,
    sceneId: '',
    questions: [] as ContextQuestion[],
    currentIndex: 0,
    currentQuestion: null as ContextQuestion | null,
    selectedIndex: -1,
    correctCount: 0,
    answerShown: false,
    finished: false,
    loading: true,
    error: '',
  },
  onLoad(query: { sceneId?: string }) {
    const sceneId = decodeURIComponent(query.sceneId || '')
    if (!sceneId) { this.setData({ loading: false, error: '场景无效' }); return }
    this.setData({ sceneId })
    this.loadQuestions(sceneId)
  },
  onShow() {
    applyAppearance(this)
    if (!this.data.loading && !this.data.answerShown && !this.data.finished && !this.data.error) this.startCountdown()
  },
  onHide() { this.stopCountdown() },
  onUnload() { this.stopCountdown() },
  stopCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer)
    this.countdownTimer = undefined
  },
  startCountdown() {
    this.stopCountdown()
    this.countdownTimer = setInterval(() => {
      const secondsLeft = Math.max(0, this.data.secondsLeft - 1)
      if (secondsLeft === 0) {
        this.stopCountdown()
        this.setData({ secondsLeft }, () => this.showAnswerResult(-1))
      } else this.setData({ secondsLeft })
    }, 1000)
  },
  async loadQuestions(sceneId: string) {
    this.stopCountdown()
    this.setData({ loading: true, error: '' })
    try {
      const questions = await loadContextQuestions(sceneId)
      if (!questions.length) throw new Error('这个场景暂时没有题目')
      this.setData({ questions, currentQuestion: questions[0], currentIndex: 0, selectedIndex: -1, correctCount: 0, answerShown: false, finished: false, loading: false, secondsLeft: 15, progressPercent: Math.round(100 / questions.length) }, () => this.startCountdown())
    } catch (error) { this.setData({ loading: false, error: error instanceof Error ? error.message : '题目加载失败' }) }
  },
  onOptionTap(event: WechatMiniprogram.BaseEvent<WechatMiniprogram.IAnyObject, { index: number }>) {
    if (this.data.answerShown) return
    const selectedIndex = Number(event.currentTarget.dataset.index)
    if (!this.data.currentQuestion || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= this.data.currentQuestion.options.length) return
    this.showAnswerResult(selectedIndex)
  },
  showAnswerResult(selectedIndex: number) {
    const question = this.data.currentQuestion
    if (this.data.answerShown || !question) return
    this.stopCountdown()
    const isCorrect = selectedIndex === question.answerIndex
    const answer = question.options[question.answerIndex]
    this.setData({ selectedIndex, answerShown: true, correctCount: this.data.correctCount + (isCorrect ? 1 : 0) }, () => {
      showCommonDialog(this, {
        title: isCorrect ? '答对了！' : selectedIndex === -1 ? '时间到！' : '答错了，再接再厉',
        content: [isCorrect ? '恭喜，答对了！' : `正确答案：${answer.text}\n${answer.pronunciation}`, question.explanation].filter(Boolean).join('\n\n'),
        showCancel: false,
        confirmText: this.data.currentIndex + 1 === this.data.questions.length ? '查看结果' : '下一题',
        onConfirm: () => this.onNextTap(),
      })
    })
  },
  onNextTap() {
    if (!this.data.answerShown || this.data.finished) return
    const next = this.data.currentIndex + 1
    if (next >= this.data.questions.length) {
      this.stopCountdown()
      const total = this.data.questions.length
      const score = Math.round(this.data.correctCount / total * 100)
      showCommonDialog(this, {
        title: '答题完成',
        content: `本轮得分：${score} 分\n答对 ${this.data.correctCount} / ${total} 题`,
        showCancel: false,
        confirmText: '完成',
        onConfirm: () => this.setData({ finished: true }),
      })
      return
    }
    this.setData({ currentIndex: next, currentQuestion: this.data.questions[next], selectedIndex: -1, answerShown: false, secondsLeft: 15, progressPercent: Math.round((next + 1) / this.data.questions.length * 100) }, () => this.startCountdown())
  },
  onRetryTap() { this.loadQuestions(this.data.sceneId) },
})

export {}
