// 光学实验理论模型：理论公式、变量与单位、适用条件、理论值计算
// 长度类理论结果统一以 mm 返回，便于界面直接对照；内部计算使用 SI 单位。

export type ExperimentId = 'double' | 'single' | 'newton'

export interface Params {
  wavelength: number // nm，波长 λ
  slitWidth: number // μm，缝宽 a
  slitSeparation: number // μm，双缝间距 d
  screenDistance: number // mm，屏距 L
  radius: number // m，牛顿环平凸透镜曲率半径 R
  order: number // 条纹级次 k
}

export type TheoryKey =
  | 'fringeSpacing' // 双缝：条纹间距 Δy
  | 'brightPosition' // 双缝：第 k 级亮纹位置 y_k
  | 'centralWidth' // 单缝：中央亮纹宽度
  | 'darkMinima' // 单缝：第 k 级暗纹位置
  | 'darkRing' // 牛顿环：第 k 级暗环半径
  | 'brightRing' // 牛顿环：第 k 级明环半径

export type TheoryResults = Partial<Record<TheoryKey, number | null>>

export type RowStatus = 'ok' | 'missing' | 'unit' | 'invalid' | 'noresult'

export interface ConditionResult {
  pass: boolean
  detail: string
}

interface VarDef {
  symbol: string
  name: string
  displayUnit: string // 界面输入单位
  expectUnit: string // 期望的 SI 单位说明
  siRange: [number, number] // 物理上合理的 SI 取值范围，越界视为疑似单位不匹配
  resolve: (p: Params) => { display: number; si: number } | undefined
}

export interface ResolvedVar {
  symbol: string
  name: string
  displayUnit: string
  expectUnit: string
  display: number | null
  si: number | null
  baselineDisplay: number | null
  present: boolean
  unitOk: boolean
  error: string | null
}

interface RowDef {
  key: TheoryKey
  name: string
  formula: string
  description: string
  condition: string
  check?: (p: Params) => ConditionResult
  vars: VarDef[]
}

export interface TheoryRow {
  key: TheoryKey
  name: string
  formula: string
  description: string
  condition: string
  conditionPass: boolean
  conditionDetail: string
  unit: string
  vars: ResolvedVar[]
  value: number | null
  baselineValue: number | null
  status: RowStatus
  reason: string
}

export interface BaselineSnap {
  params: Params
  results: TheoryResults
  time: string
}

// ---------- 变量定义 ----------

const lambdaVar: VarDef = {
  symbol: 'λ',
  name: '波长',
  displayUnit: 'nm',
  expectUnit: 'm（界面以 nm 输入）',
  siRange: [1e-9, 1e-3],
  resolve: (p) =>
    p.wavelength === undefined || Number.isNaN(p.wavelength)
      ? undefined
      : { display: p.wavelength, si: p.wavelength * 1e-9 },
}

const slitWidthVar: VarDef = {
  symbol: 'a',
  name: '缝宽',
  displayUnit: 'μm',
  expectUnit: 'm（界面以 μm 输入）',
  siRange: [1e-8, 1e-2],
  resolve: (p) =>
    p.slitWidth === undefined || Number.isNaN(p.slitWidth)
      ? undefined
      : { display: p.slitWidth, si: p.slitWidth * 1e-6 },
}

const slitSepVar: VarDef = {
  symbol: 'd',
  name: '双缝间距',
  displayUnit: 'μm',
  expectUnit: 'm（界面以 μm 输入）',
  siRange: [1e-8, 1e-2],
  resolve: (p) =>
    p.slitSeparation === undefined || Number.isNaN(p.slitSeparation)
      ? undefined
      : { display: p.slitSeparation, si: p.slitSeparation * 1e-6 },
}

const screenDistVar: VarDef = {
  symbol: 'L',
  name: '屏距',
  displayUnit: 'mm',
  expectUnit: 'm（界面以 mm 输入）',
  siRange: [1e-4, 1e2],
  resolve: (p) =>
    p.screenDistance === undefined || Number.isNaN(p.screenDistance)
      ? undefined
      : { display: p.screenDistance, si: p.screenDistance * 1e-3 },
}

const radiusVar: VarDef = {
  symbol: 'R',
  name: '曲率半径',
  displayUnit: 'm',
  expectUnit: 'm',
  siRange: [1e-4, 1e2],
  resolve: (p) =>
    p.radius === undefined || Number.isNaN(p.radius)
      ? undefined
      : { display: p.radius, si: p.radius },
}

const orderVar: VarDef = {
  symbol: 'k',
  name: '条纹级次',
  displayUnit: '级',
  expectUnit: '无量纲整数',
  siRange: [0, 20],
  resolve: (p) =>
    p.order === undefined || Number.isNaN(p.order)
      ? undefined
      : { display: p.order, si: p.order },
}

// ---------- 适用条件检查 ----------

function smallAngle(theta: number): ConditionResult {
  const ok = Number.isFinite(theta) && Math.abs(theta) <= 0.1
  return {
    pass: ok,
    detail: `θ≈${fmtNum(Math.abs(theta))} rad，要求 |θ|≲0.1 rad（tanθ≈sinθ）`,
  }
}

// 夫琅禾费远场判据：Lλ/b² ≳ 100（b 为缝宽或缝间距）
function farField(L: number, lambda: number, b: number): ConditionResult {
  const ratio = b > 0 ? (L * lambda) / (b * b) : NaN
  return {
    pass: Number.isFinite(ratio) && ratio >= 100,
    detail: `Lλ/b²=${fmtNum(ratio)}，≳100 为严格远场`,
  }
}

// 牛顿环球面近似：r²≪R²，即 kλ/R≪1
function sagittaApprox(k: number, lambda: number, R: number): ConditionResult {
  const q = R > 0 ? (k * lambda) / R : NaN
  return {
    pass: Number.isFinite(q) && q <= 0.01,
    detail: `kλ/R=${fmtNum(q)}，要求 ≪0.01（即 r≪R，h=r²/2R 近似成立）`,
  }
}

// ---------- 各实验对照项定义 ----------

const ROWS: Record<ExperimentId, RowDef[]> = {
  double: [
    {
      key: 'fringeSpacing',
      name: '相邻条纹间距 Δy',
      formula: 'Δy = λL / d',
      description: '相邻亮纹（或暗纹）中心的间距；理想双缝条纹等宽、等距、明暗相间。',
      condition: '单色相干光；远场 L≫d²/λ；小角近似；且缝宽 a<缝间距 d（单缝包络内可容纳多道条纹）。',
      vars: [lambdaVar, slitSepVar, screenDistVar, slitWidthVar],
      check: (p) => {
        const lam = p.wavelength * 1e-9
        const L = p.screenDistance * 1e-3
        const d = p.slitSeparation * 1e-6
        const a = p.slitWidth * 1e-6
        const ff = farField(L, lam, d)
        const geom = a > 0 && d > 0 ? a < d : false
        return {
          pass: ff.pass && geom,
          detail: `${ff.detail}；${a > 0 && d > 0 ? `a/d=${fmtNum(a / d)}，需 a<d` : 'a、d 需为正值'}`,
        }
      },
    },
    {
      key: 'brightPosition',
      name: '第 k 级亮纹位置 y_k',
      formula: 'y_k = kλL / d（k=0,±1,±2…）',
      description: '第 k 级亮纹中心到中央亮纹的距离，正负级次关于中央对称。',
      condition: '远场、小角近似；级次 k 越大偏角越大，大级次偏离小角条件且受单缝包络调制。',
      vars: [lambdaVar, slitSepVar, screenDistVar, orderVar],
      check: (p) => {
        const lam = p.wavelength * 1e-9
        const d = p.slitSeparation * 1e-6
        const L = p.screenDistance * 1e-3
        const ff = farField(L, lam, d)
        const sa = smallAngle((p.order * lam) / d)
        return { pass: ff.pass && sa.pass, detail: `${ff.detail}；${sa.detail}` }
      },
    },
  ],
  single: [
    {
      key: 'centralWidth',
      name: '中央亮纹宽度 Δy₀',
      formula: 'Δy₀ = 2λL / a',
      description: '中央主极大两侧第一级暗纹（a·sinθ=±λ）之间的宽度，是最宽最亮的条纹。',
      condition: '夫琅禾费远场 L≫a²/λ；小角近似；单色平行光垂直入射。',
      vars: [lambdaVar, slitWidthVar, screenDistVar],
      check: (p) => farField(p.screenDistance * 1e-3, p.wavelength * 1e-9, p.slitWidth * 1e-6),
    },
    {
      key: 'darkMinima',
      name: '第 k 级暗纹位置 x_k',
      formula: 'a·sinθ = kλ，x_k ≈ kλL/a（k=±1,±2…）',
      description: '单缝衍射暗纹中心位置；暗纹间亮纹宽度约 λL/a，光强向两侧迅速衰减。',
      condition: '夫琅禾费远场；小角近似 sinθ≈tanθ≈θ；级次受 k<a/λ 限制。',
      vars: [lambdaVar, slitWidthVar, screenDistVar, orderVar],
      check: (p) => {
        const lam = p.wavelength * 1e-9
        const a = p.slitWidth * 1e-6
        const L = p.screenDistance * 1e-3
        const ff = farField(L, lam, a)
        const sa = smallAngle((p.order * lam) / a)
        const kmax = a / lam
        const inRange = p.order <= kmax
        return {
          pass: ff.pass && sa.pass && inRange,
          detail: `${ff.detail}；${sa.detail}；k< a/λ=${fmtNum(kmax, 1)}`,
        }
      },
    },
  ],
  newton: [
    {
      key: 'darkRing',
      name: '第 k 级暗环半径 r_k',
      formula: 'r_k = √(kλR)（k=0,1,2…）',
      description: '反射光干涉暗环半径；接触点 k=0 为暗斑。反射面存在半波损失，故中心为暗环。',
      condition: '空气膜折射率 n≈1；单色光垂直正入射；球面近似 r≪R；平凸透镜与平玻璃紧密接触。',
      vars: [lambdaVar, radiusVar, orderVar],
      check: (p) => sagittaApprox(p.order, p.wavelength * 1e-9, p.radius),
    },
    {
      key: 'brightRing',
      name: '第 k 级明环半径 r_k′',
      formula: "r_k′ = √((k−1/2)λR)（k=1,2…）",
      description: '反射光明环半径，与同级暗环相间；透射光明暗环位置与反射光互补。',
      condition: '同暗环：n≈1、正入射、r≪R；k 从 1 开始。',
      vars: [lambdaVar, radiusVar, orderVar],
      check: (p) => sagittaApprox(p.order, p.wavelength * 1e-9, p.radius),
    },
  ],
}

export const EXPERIMENT_THEORY: Record<ExperimentId, { name: string; rows: RowDef[] }> = {
  double: { name: '双缝干涉（Young）', rows: ROWS.double },
  single: { name: '单缝衍射（Fraunhofer）', rows: ROWS.single },
  newton: { name: '牛顿环干涉', rows: ROWS.newton },
}

// ---------- 理论值计算（store 与对照视图共用，保证同源） ----------

export function computeTheory(exp: ExperimentId, p: Params): TheoryResults {
  const lam = p.wavelength * 1e-9
  const a = p.slitWidth * 1e-6
  const d = p.slitSeparation * 1e-6
  const L = p.screenDistance * 1e-3
  const R = p.radius
  const k = p.order
  const toMm = 1e3
  const out: TheoryResults = {}
  const safe = (v: number) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null)

  if (exp === 'double') {
    if (d > 0 && L > 0 && lam > 0) {
      out.fringeSpacing = safe((lam * L / d) * toMm)
      out.brightPosition = safe((k * lam * L / d) * toMm)
    }
  } else if (exp === 'single') {
    if (a > 0 && L > 0 && lam > 0) {
      out.centralWidth = safe((2 * lam * L / a) * toMm)
      out.darkMinima = safe((k * lam * L / a) * toMm)
    }
  } else {
    if (R > 0 && lam > 0) {
      out.darkRing = k >= 0 ? safe(Math.sqrt(k * lam * R) * toMm) : null
      out.brightRing = k >= 1 ? safe(Math.sqrt((k - 0.5) * lam * R) * toMm) : null
    }
  }
  return out
}

// ---------- 对照行构建（含变量缺失 / 单位异常 / 无结果原因标注） ----------

function resolveVar(def: VarDef, p: Params, bp: Params | null): ResolvedVar {
  const cur = def.resolve(p)
  const base = bp ? def.resolve(bp) : undefined
  const present = cur !== undefined
  let unitOk = true
  let error: string | null = null
  if (present) {
    const v = cur!.si
    if (!Number.isFinite(v) || v <= 0) {
      unitOk = false
      error = `${def.symbol} 必须为正的有限值，请核对输入单位（期望：${def.expectUnit}）`
    } else if (v < def.siRange[0] || v > def.siRange[1]) {
      unitOk = false
      error = `${def.symbol}=${fmtNum(cur!.display)} ${def.displayUnit} 超出合理量程，疑似单位不匹配（期望：${def.expectUnit}）`
    }
  } else {
    error = `变量 ${def.symbol}（${def.name}）缺失，无法代入公式`
  }
  return {
    symbol: def.symbol,
    name: def.name,
    displayUnit: def.displayUnit,
    expectUnit: def.expectUnit,
    display: cur ? cur.display : null,
    si: cur ? cur.si : null,
    baselineDisplay: base ? base.display : null,
    present,
    unitOk,
    error,
  }
}

export function buildTheoryRows(
  exp: ExperimentId,
  params: Params,
  current: TheoryResults,
  baseline: BaselineSnap | null,
): TheoryRow[] {
  const theory = computeTheory(exp, params)
  return EXPERIMENT_THEORY[exp].rows.map((def) => {
    const vars = def.vars.map((v) => resolveVar(v, params, baseline ? baseline.params : null))
    const missing = vars.find((v) => !v.present)
    const badUnit = vars.find((v) => v.present && !v.unitOk)
    const rawValue = theory[def.key]
    const hasValue = rawValue !== undefined && rawValue !== null && Number.isFinite(rawValue)
    const computed = current[def.key]
    const hasCurrent = computed !== undefined && computed !== null && Number.isFinite(computed)

    let status: RowStatus = 'ok'
    let reason = ''
    if (missing) {
      status = 'missing'
      reason = missing.error!
    } else if (badUnit) {
      status = 'unit'
      reason = badUnit.error!
    } else if (!hasCurrent) {
      status = 'noresult'
      reason = `当前实验尚未输出「${def.name}」的计算结果（计算未运行或未覆盖该量），无法对照`
    } else if (!hasValue) {
      status = 'invalid'
      reason = '代入当前参数后公式无有效数值（请检查参数是否为正、级次是否合法）'
    }

    const cond = def.check ? def.check(params) : { pass: true, detail: '该公式为定义式，无额外限制条件。' }
    const bv = baseline ? baseline.results[def.key] : null

    return {
      key: def.key,
      name: def.name,
      formula: def.formula,
      description: def.description,
      condition: def.condition,
      conditionPass: cond.pass,
      conditionDetail: cond.detail,
      unit: 'mm',
      vars,
      value: hasValue ? rawValue! : null,
      baselineValue: bv !== undefined && bv !== null && Number.isFinite(bv) ? bv : null,
      status,
      reason,
    }
  })
}

export function fmtNum(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—'
  if (v !== 0 && Math.abs(v) < 1e-3) return v.toExponential(2)
  return String(Math.round(v * 10 ** digits) / 10 ** digits)
}

export const STATUS_META: Record<RowStatus, { label: string; cls: string }> = {
  ok: { label: '可对照', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
  missing: { label: '变量缺失', cls: 'bg-red-900/50 text-red-300 border-red-700' },
  unit: { label: '单位/数值异常', cls: 'bg-red-900/50 text-red-300 border-red-700' },
  invalid: { label: '无有效结果', cls: 'bg-red-900/50 text-red-300 border-red-700' },
  noresult: { label: '当前实验未计算', cls: 'bg-amber-900/50 text-amber-300 border-amber-700' },
}
