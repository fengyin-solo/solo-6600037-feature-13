<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div>
        <h3 class="text-sm font-bold text-slate-400">理论结果对照</h3>
        <p class="text-xs text-slate-600 mt-0.5">对照项与理论值随实验切换自动同步，各实验基准独立保存</p>
      </div>
      <div class="space-x-2">
        <button @click="theory.snapshotBaseline()"
          class="px-3 py-1 text-xs rounded border border-cyan-600 text-cyan-400 hover:bg-cyan-900/40 transition-colors">
          记录为调整前基准
        </button>
        <button v-if="theory.baseline" @click="theory.clearBaseline()"
          class="px-3 py-1 text-xs rounded border border-slate-600 text-slate-400 hover:bg-slate-700 transition-colors">
          清除基准
        </button>
      </div>
    </div>

    <!-- 公式补充变量：清空可模拟变量缺失，R 选错单位可模拟单位不匹配 -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs text-slate-400">
      <template v-if="store.currentExperiment === 'double'">
        <label>亮纹级次 k =
          <input type="number" min="0" max="50" step="1" v-model.number="theory.extras.orderK" :class="inputCls" />
        </label>
      </template>
      <template v-if="store.currentExperiment === 'single'">
        <label>暗纹级次 k =
          <input type="number" min="1" max="50" step="1" v-model.number="theory.extras.darkK" :class="inputCls" />
        </label>
      </template>
      <template v-if="store.currentExperiment === 'newton'">
        <label>环级次 n =
          <input type="number" min="1" max="200" step="1" v-model.number="theory.extras.ringN" :class="inputCls" />
        </label>
        <label>曲率半径 R =
          <input type="number" min="0" step="0.1" v-model.number="theory.extras.curvatureR" :class="inputCls" />
          <select v-model="theory.extras.curvatureUnit" class="ml-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-300">
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
        </label>
      </template>
    </div>

    <div v-if="theory.baseline" class="text-xs text-slate-500 mb-2">
      调整前基准参数：{{ baselineSummary }}
    </div>
    <div v-else class="text-xs text-slate-600 mb-2">
      尚未记录基准。点击「记录为调整前基准」后调节参数，即可对照调整前后的理论结果。
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="text-left text-slate-500 border-b border-slate-700">
            <th class="py-1.5 pr-3 font-normal">理论公式</th>
            <th class="py-1.5 pr-3 font-normal">公式说明 / 适用条件</th>
            <th class="py-1.5 pr-3 font-normal text-right">调整前</th>
            <th class="py-1.5 pr-3 font-normal text-right">当前理论值</th>
            <th class="py-1.5 pr-3 font-normal text-right">变化 Δ</th>
            <th class="py-1.5 pr-3 font-normal text-right">仿真结果</th>
            <th class="py-1.5 font-normal">状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in theory.evaluations" :key="e.def.id" class="border-b border-slate-700/50 align-top">
            <td class="py-2 pr-3 whitespace-nowrap">
              <div class="text-slate-200">{{ e.def.name }}</div>
              <div class="text-cyan-400 font-mono">{{ e.def.formula }}</div>
              <div class="text-slate-500 mt-0.5">
                <span v-for="v in e.def.variables" :key="v.key" class="mr-1.5">{{ v.symbol }}:{{ v.unit }}</span>
              </div>
            </td>
            <td class="py-2 pr-3 text-slate-400 min-w-40">
              <div>{{ e.def.description }}</div>
              <div class="text-slate-500 mt-0.5">适用条件：{{ e.def.condition }}</div>
            </td>
            <td class="py-2 pr-3 text-right whitespace-nowrap text-slate-400">
              {{ baselineText(e.def.id) }}<span v-if="hasBaselineValue(e.def.id)" class="text-slate-600"> {{ e.def.resultUnit }}</span>
            </td>
            <td class="py-2 pr-3 text-right whitespace-nowrap text-yellow-400">
              {{ fmt(e.value) }}<span v-if="e.value !== null" class="text-slate-600"> {{ e.def.resultUnit }}</span>
            </td>
            <td class="py-2 pr-3 text-right whitespace-nowrap" :class="deltaClass(e)">{{ deltaText(e) }}</td>
            <td class="py-2 pr-3 text-right whitespace-nowrap text-slate-300">
              <template v-if="e.simulation !== null">{{ fmt(e.simulation) }}<span class="text-slate-600"> {{ e.def.resultUnit }}</span></template>
              <template v-else>—</template>
            </td>
            <td class="py-2">
              <div class="flex flex-col gap-1">
                <span v-for="(issue, i) in e.issues" :key="i"
                  class="inline-block px-1.5 py-0.5 rounded border whitespace-nowrap" :class="issueClass(issue.type)">
                  {{ issue.message }}
                </span>
                <span v-if="!e.issues.length" class="text-green-400">正常</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOpticsStore } from '../store/optics'
import { useTheoryStore } from '../store/theory'
import type { Evaluation, IssueType } from '../theory'

const store = useOpticsStore()
const theory = useTheoryStore()

const inputCls = 'w-16 ml-1 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-slate-200'

const baselineSummary = computed(() => {
  const b = theory.baseline
  if (!b) return ''
  const p = b.params
  const parts = [`λ=${p.wavelength}nm`, `a=${p.slitWidth}μm`, `D=${p.slitSeparation}μm`, `L=${p.screenDistance}mm`]
  if (store.currentExperiment === 'double') parts.push(`k=${b.extras.orderK ?? '—'}`)
  if (store.currentExperiment === 'single') parts.push(`k=${b.extras.darkK ?? '—'}`)
  if (store.currentExperiment === 'newton') parts.push(`n=${b.extras.ringN ?? '—'}`, `R=${b.extras.curvatureR ?? '—'}${b.extras.curvatureUnit}`)
  return parts.join('，')
})

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e5 || abs < 1e-3)) return v.toExponential(2)
  return String(Number(v.toFixed(3)))
}

function baselineValue(id: string): number | null | undefined {
  return theory.baseline?.values[id]
}

function hasBaselineValue(id: string): boolean {
  const v = baselineValue(id)
  return v !== null && v !== undefined
}

function baselineText(id: string): string {
  if (!theory.baseline) return '—'
  return fmt(baselineValue(id))
}

function delta(e: Evaluation): number | null {
  const base = baselineValue(e.def.id)
  if (e.value === null || base === null || base === undefined) return null
  return e.value - base
}

function deltaText(e: Evaluation): string {
  const d = delta(e)
  if (d === null) return '—'
  const base = baselineValue(e.def.id) as number
  const sign = d > 0 ? '+' : ''
  const pct = base !== 0 ? ` (${sign}${(d / base * 100).toFixed(1)}%)` : ''
  return `${sign}${fmt(d)}${pct}`
}

function deltaClass(e: Evaluation): string {
  const d = delta(e)
  if (d === null || d === 0) return 'text-slate-500'
  return d > 0 ? 'text-green-400' : 'text-red-400'
}

function issueClass(type: IssueType): string {
  switch (type) {
    case 'missing-variable': return 'bg-red-900/40 text-red-400 border-red-800'
    case 'unit-mismatch': return 'bg-orange-900/40 text-orange-400 border-orange-800'
    case 'no-result': return 'bg-slate-700/40 text-slate-400 border-slate-600'
  }
}
</script>
