// 理论公式定义与求值校验
// 对照视图的数据层：每个实验列出理论公式、变量、说明与适用条件，
// 并在求值时标出「公式变量缺失 / 单位不匹配 / 当前实验没有计算结果」三类原因。

export type ExperimentId = 'double' | 'single' | 'newton'

export interface TheoryParams {
  wavelength: number      // nm
  slitWidth: number       // μm
  slitSeparation: number  // μm
  screenDistance: number  // mm
}

// 对照视图补充的公式变量（不进入仿真实验参数）
export interface ExtraInputs {
  orderK: number | null       // 双缝亮纹级次 k
  darkK: number | null        // 单缝暗纹级次 k
  ringN: number | null        // 牛顿环级次 n
  curvatureR: number | null   // 牛顿环曲率半径数值
  curvatureUnit: 'm' | 'mm'   // 曲率半径单位（公式要求 m，可选错以触发单位不匹配）
}

export interface VariableDef {
  key: string
  symbol: string
  name: string
  unit: string                 // 公式要求的单位
  range?: [number, number]     // 该单位下的合理取值范围，超出视为单位不匹配
}

export interface FormulaDef {
  id: string
  experiment: ExperimentId
  name: string
  formula: string
  description: string          // 公式说明
  condition: string            // 适用条件
  resultUnit: string
  variables: VariableDef[]
  nonZero?: string[]           // 作为分母、不能为 0 的变量
  resultKey?: 'fringe' | 'centralWidth'  // 仿真结果中可对照的字段
  compute: (v: Record<string, number>) => number  // 返回 resultUnit 下的数值
}

export type IssueType = 'missing-variable' | 'unit-mismatch' | 'no-result'

export interface Issue {
  type: IssueType
  message: string
}

export interface VarValue {
  value: number | undefined
  unit: string
}

export interface Evaluation {
  def: FormulaDef
  value: number | null         // 当前理论值，无法计算时为 null
  simulation: number | null    // 仿真实验计算结果，无对应结果时为 null
  issues: Issue[]
}

const LAMBDA: VariableDef = { key: 'wavelength', symbol: 'λ', name: '波长', unit: 'nm', range: [100, 10000] }
const SCREEN: VariableDef = { key: 'screenDistance', symbol: 'L', name: '屏幕距离', unit: 'mm', range: [1, 1e6] }
const SLIT_W: VariableDef = { key: 'slitWidth', symbol: 'a', name: '缝宽', unit: 'μm', range: [0.1, 1e5] }
const SLIT_D: VariableDef = { key: 'slitSeparation', symbol: 'd', name: '双缝间距', unit: 'μm', range: [0.1, 1e5] }
const ORDER_K: VariableDef = { key: 'orderK', symbol: 'k', name: '亮纹级次', unit: '无量纲', range: [0, 50] }
const DARK_K: VariableDef = { key: 'darkK', symbol: 'k', name: '暗纹级次', unit: '无量纲', range: [1, 50] }
const RING_N: VariableDef = { key: 'ringN', symbol: 'n', name: '环级次', unit: '无量纲', range: [1, 200] }
const CURV_R: VariableDef = { key: 'curvatureR', symbol: 'R', name: '曲率半径', unit: 'm', range: [0.01, 100] }

export const FORMULAS: FormulaDef[] = [
  {
    id: 'fringe-spacing',
    experiment: 'double',
    name: '条纹间距',
    formula: 'Δy = λL / d',
    description: '相邻亮纹（或暗纹）中心的间距，与波长、屏距成正比，与双缝间距成反比',
    condition: '单色平行光；近轴近似 L ≫ d；双缝等宽',
    resultUnit: 'mm',
    variables: [LAMBDA, SCREEN, SLIT_D],
    nonZero: ['slitSeparation'],
    resultKey: 'fringe',
    compute: v => (v.wavelength * 1e-9 * v.screenDistance * 1e-3) / (v.slitSeparation * 1e-6) * 1e3,
  },
  {
    id: 'kth-maxima',
    experiment: 'double',
    name: '第 k 级亮纹位置',
    formula: 'y_k = k·λL / d',
    description: '第 k 级干涉亮纹到中央亮纹的距离，k 取级次绝对值',
    condition: '近轴近似 sinθ ≈ tanθ；k = 0, ±1, ±2 …',
    resultUnit: 'mm',
    variables: [ORDER_K, LAMBDA, SCREEN, SLIT_D],
    nonZero: ['slitSeparation'],
    compute: v => Math.abs(v.orderK) * (v.wavelength * 1e-9 * v.screenDistance * 1e-3) / (v.slitSeparation * 1e-6) * 1e3,
  },
  {
    id: 'central-width',
    experiment: 'single',
    name: '中央亮纹宽度',
    formula: 'Δy₀ = 2λL / a',
    description: '两侧第一暗纹之间的距离，约为其他亮纹宽度的两倍',
    condition: '夫琅禾费衍射（远场）；近轴近似；a ≫ λ',
    resultUnit: 'mm',
    variables: [LAMBDA, SCREEN, SLIT_W],
    nonZero: ['slitWidth'],
    resultKey: 'centralWidth',
    compute: v => (2 * v.wavelength * 1e-9 * v.screenDistance * 1e-3) / (v.slitWidth * 1e-6) * 1e3,
  },
  {
    id: 'kth-minima',
    experiment: 'single',
    name: '第 k 级暗纹位置',
    formula: 'y_k = k·λL / a',
    description: '第 k 级暗纹到中心的距离，对应暗纹条件 a·sinθ = kλ',
    condition: '近轴近似 sinθ ≈ tanθ；k = ±1, ±2 …',
    resultUnit: 'mm',
    variables: [DARK_K, LAMBDA, SCREEN, SLIT_W],
    nonZero: ['slitWidth'],
    compute: v => Math.abs(v.darkK) * (v.wavelength * 1e-9 * v.screenDistance * 1e-3) / (v.slitWidth * 1e-6) * 1e3,
  },
  {
    id: 'dark-ring-radius',
    experiment: 'newton',
    name: '第 n 级暗环半径',
    formula: 'r_n = √(nλR)',
    description: '等厚干涉暗环半径与级次的平方根成正比，可用于测曲率半径或波长',
    condition: '垂直入射；暗环条件 2d = nλ（含半波损失）；n = 0, 1, 2 …',
    resultUnit: 'mm',
    variables: [RING_N, LAMBDA, CURV_R],
    nonZero: ['curvatureR'],
    compute: v => Math.sqrt(v.ringN * v.wavelength * 1e-9 * v.curvatureR) * 1e3,
  },
  {
    id: 'film-thickness',
    experiment: 'newton',
    name: '第 n 级暗环处膜厚',
    formula: 'd = nλ / 2',
    description: '第 n 级暗环对应的空气膜厚度，与曲率半径无关',
    condition: '垂直入射；考虑半波损失；n = 0, 1, 2 …',
    resultUnit: 'μm',
    variables: [RING_N, LAMBDA],
    compute: v => (v.ringN * v.wavelength * 1e-9) / 2 * 1e6,
  },
]

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

// 汇总实验参数与补充变量，并标注各自当前单位
export function buildVarValues(params: TheoryParams, extras: ExtraInputs): Record<string, VarValue> {
  return {
    wavelength: { value: num(params.wavelength), unit: 'nm' },
    slitWidth: { value: num(params.slitWidth), unit: 'μm' },
    slitSeparation: { value: num(params.slitSeparation), unit: 'μm' },
    screenDistance: { value: num(params.screenDistance), unit: 'mm' },
    orderK: { value: num(extras.orderK), unit: '无量纲' },
    darkK: { value: num(extras.darkK), unit: '无量纲' },
    ringN: { value: num(extras.ringN), unit: '无量纲' },
    curvatureR: { value: num(extras.curvatureR), unit: extras.curvatureUnit },
  }
}

export function evaluate(
  def: FormulaDef,
  vars: Record<string, VarValue>,
  simulationResult: { fringe?: number; centralWidth?: number },
): Evaluation {
  const issues: Issue[] = []
  const resolved: Record<string, number> = {}
  let computable = true

  for (const v of def.variables) {
    const entry = vars[v.key]
    const value = entry?.value
    if (value === undefined || Number.isNaN(value)) {
      issues.push({ type: 'missing-variable', message: `公式变量缺失：${v.symbol}（${v.name}）` })
      computable = false
      continue
    }
    if (entry && entry.unit !== v.unit) {
      issues.push({ type: 'unit-mismatch', message: `单位不匹配：${v.symbol} 当前单位为 ${entry.unit}，公式要求 ${v.unit}` })
      computable = false
      continue
    }
    if (def.nonZero?.includes(v.key) && value === 0) {
      issues.push({ type: 'missing-variable', message: `公式变量无效：${v.symbol}（${v.name}）为 0，无法计算` })
      computable = false
      continue
    }
    if (v.range && (value < v.range[0] || value > v.range[1])) {
      issues.push({ type: 'unit-mismatch', message: `单位不匹配：${v.symbol} = ${value} ${v.unit} 超出合理范围 [${v.range[0]}, ${v.range[1]}]，请检查单位` })
      computable = false
      continue
    }
    resolved[v.key] = value
  }

  const simulation = def.resultKey ? simulationResult[def.resultKey] ?? null : null
  if (simulation === null) {
    issues.push({ type: 'no-result', message: '当前实验没有该公式对应的计算结果' })
  }

  let value: number | null = null
  if (computable) {
    const raw = def.compute(resolved)
    if (Number.isFinite(raw)) {
      value = raw
    } else {
      issues.push({ type: 'missing-variable', message: '计算结果无效，请检查公式变量' })
    }
  }

  return { def, value, simulation, issues }
}
