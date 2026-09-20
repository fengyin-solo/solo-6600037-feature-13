import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import { useOpticsStore } from './optics'
import { buildVarValues, evaluate, FORMULAS, type Evaluation, type ExtraInputs } from '../theory'

// 「调整前」基准快照：记录参数与当时各公式的理论值，用于对照调整前后的结果
export interface Baseline {
  params: { wavelength: number; slitWidth: number; slitSeparation: number; screenDistance: number }
  extras: ExtraInputs
  values: Record<string, number | null>
}

export const useTheoryStore = defineStore('theory', () => {
  const optics = useOpticsStore()

  // 公式补充变量（级次 k/n、曲率半径 R），仅用于理论对照，不影响仿真实验
  const extras = reactive<ExtraInputs>({ orderK: 1, darkK: 1, ringN: 5, curvatureR: 1.0, curvatureUnit: 'm' })

  // 每个实验各自保存一份基准，切换实验互不影响
  const baselines = reactive<Record<string, Baseline>>({})

  const formulas = computed(() => FORMULAS.filter(f => f.experiment === optics.currentExperiment))

  // 对照项与理论值随当前实验、参数实时同步
  const evaluations = computed<Evaluation[]>(() => {
    const vars = buildVarValues(optics.params, extras)
    return formulas.value.map(def => evaluate(def, vars, optics.result))
  })

  const baseline = computed<Baseline | undefined>(() => baselines[optics.currentExperiment])

  function snapshotBaseline() {
    baselines[optics.currentExperiment] = {
      params: { ...optics.params },
      extras: { ...extras },
      values: Object.fromEntries(evaluations.value.map(e => [e.def.id, e.value])),
    }
  }

  function clearBaseline() {
    delete baselines[optics.currentExperiment]
  }

  return { extras, baselines, formulas, evaluations, baseline, snapshotBaseline, clearBaseline }
})
