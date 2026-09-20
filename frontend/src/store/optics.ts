import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  type ExperimentId,
  type Params,
  type TheoryResults,
  type BaselineSnap,
  computeTheory,
} from '../physics/theory'

export const useOpticsStore = defineStore('optics', () => {
  const currentExperiment = ref<ExperimentId>('double')
  // 各实验独立保存参数：切换实验时原有公式与结果不受影响
  const allParams = ref<Record<ExperimentId, Params>>({
    double: { wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000, radius: 1.0, order: 1 },
    single: { wavelength: 550, slitWidth: 50, slitSeparation: 200, screenDistance: 1000, radius: 1.0, order: 1 },
    newton: { wavelength: 589, slitWidth: 50, slitSeparation: 200, screenDistance: 1000, radius: 1.0, order: 3 },
  })
  const intensityData = ref<number[]>([])
  const theoryResult = ref<TheoryResults>({})
  const computedAt = ref<number | null>(null)
  // 各实验的「调整前」基线，随实验切换自动同步；不存在时首次计算后记录
  const baselines = ref<Partial<Record<ExperimentId, BaselineSnap>>>({})
  const autoBaseline = ref<Partial<Record<ExperimentId, boolean>>>({})

  const params = ref<Params>(allParams.value.double)

  function snapshot(id: ExperimentId, p: Params, results: TheoryResults): BaselineSnap {
    return {
      params: { ...p },
      results: { ...results },
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }
  }

  function setExperiment(id: ExperimentId) {
    if (id === currentExperiment.value) return
    currentExperiment.value = id
    params.value = allParams.value[id]
    compute()
    ensureBaseline()
  }

  // 首次进入某实验：以当前结果作为「调整前」基线，保证对照项与理论值同步
  function ensureBaseline() {
    const id = currentExperiment.value
    if (!baselines.value[id]) {
      autoBaseline.value[id] = true
      baselines.value[id] = snapshot(id, params.value, { ...theoryResult.value })
    }
  }

  function compute() {
    const p = params.value
    const { wavelength: lam, slitWidth: a, slitSeparation: d, screenDistance: L, radius: R } = p
    const lambda = lam * 1e-9
    const aM = a * 1e-6
    const dM = d * 1e-6
    const LM = L * 1e-3
    const N = 800
    const data: number[] = []
    const xMax = 20e-3

    if (currentExperiment.value === 'double') {
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const delta = (Math.PI * dM * x) / (lambda * LM)
        const beta = (Math.PI * aM * x) / (lambda * LM) || 1e-10
        const single = Math.sin(beta) / beta
        data.push(Math.max(0, Math.cos(delta) ** 2 * single ** 2))
      }
    } else if (currentExperiment.value === 'single') {
      for (let i = 0; i < N; i++) {
        const x = (i / N - 0.5) * xMax * 2
        const beta = (Math.PI * aM * x) / (lambda * LM) || 1e-10
        data.push(Math.max(0, (Math.sin(beta) / beta) ** 2))
      }
    } else {
      for (let i = 0; i < N; i++) {
        const r = (i / N) * 5e-3
        const path = (r * r) / (2 * R)
        const phi = (2 * Math.PI * path) / lambda + Math.PI
        data.push(Math.max(0, 0.5 * (1 - Math.cos(phi))))
      }
    }

    theoryResult.value = computeTheory(currentExperiment.value, p)
    computedAt.value = Date.now()
    intensityData.value = data
  }

  // 将当前结果记录为新的「调整前」基线
  function captureBaseline() {
    baselines.value[currentExperiment.value] = snapshot(
      currentExperiment.value,
      params.value,
      { ...theoryResult.value },
    )
    autoBaseline.value[currentExperiment.value] = false
  }

  function resetBaseline() {
    delete baselines.value[currentExperiment.value]
    autoBaseline.value[currentExperiment.value] = false
  }

  function restoreBaselineParams() {
    const b = baselines.value[currentExperiment.value]
    if (b) {
      allParams.value[currentExperiment.value] = { ...b.params }
      params.value = allParams.value[currentExperiment.value]
      compute()
    }
  }

  return {
    currentExperiment,
    params,
    intensityData,
    theoryResult,
    computedAt,
    baselines,
    setExperiment,
    compute,
    ensureBaseline,
    captureBaseline,
    resetBaseline,
    restoreBaselineParams,
  }
})
