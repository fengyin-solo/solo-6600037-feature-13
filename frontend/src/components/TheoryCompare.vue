<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div>
        <h3 class="text-sm font-bold text-slate-300">理论结果对照视图 · {{ theoryMeta.name }}</h3>
        <p class="text-xs text-slate-500 mt-0.5">理论公式、当前理论值、公式说明与适用条件，并对照参数调整前后的结果</p>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <button @click="store.captureBaseline()"
          class="px-3 py-1.5 rounded border border-cyan-700 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/60 transition-colors">
          将当前记为调整前
        </button>
        <button v-if="baseline" @click="store.restoreBaselineParams()"
          class="px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-slate-400 transition-colors">
          恢复调整前参数
        </button>
        <button v-if="baseline" @click="store.resetBaseline()"
          class="px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 transition-colors">
          清除基线
        </button>
      </div>
    </div>

    <!-- 基线信息 -->
    <div class="text-xs mb-3 rounded border px-3 py-2"
      :class="baseline ? 'border-slate-700 bg-slate-900/60 text-slate-400' : 'border-amber-800 bg-amber-900/20 text-amber-300'">
      <template v-if="baseline">
        <span class="font-bold">调整前基线（{{ baseline.time }}）：</span>
        λ={{ baseline.params.wavelength }} nm<template v-if="store.currentExperiment !== 'newton'">
          ，a={{ baseline.params.slitWidth }} μm</template><template v-if="store.currentExperiment === 'double'">
          ，d={{ baseline.params.slitSeparation }} μm</template><template v-if="store.currentExperiment !== 'newton'">
          ，L={{ baseline.params.screenDistance }} mm</template><template v-if="store.currentExperiment === 'newton'">
          ，R={{ baseline.params.radius }} m</template>，k={{ baseline.params.order }}
      </template>
      <template v-else>尚无「调整前」基线——请先调节参数后点击「将当前记为调整前」，或先返回记录过基线的实验。</template>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs min-w-[960px]">
        <thead>
          <tr class="text-slate-500 border-b border-slate-700">
            <th class="text-left font-semibold py-2 pr-3 w-40">对照项</th>
            <th class="text-left font-semibold py-2 pr-3 w-48">理论公式</th>
            <th class="text-left font-semibold py-2 pr-3">公式说明</th>
            <th class="text-left font-semibold py-2 pr-3 w-56">适用条件</th>
            <th class="text-left font-semibold py-2 pr-3 w-64">公式变量（当前值）</th>
            <th class="text-right font-semibold py-2 pr-3 w-28">调整前</th>
            <th class="text-right font-semibold py-2 pr-3 w-28">当前理论值</th>
            <th class="text-right font-semibold py-2 w-28">变化量 Δ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-b border-slate-800 align-top">
            <!-- 对照项 -->
            <td class="py-3 pr-3">
              <div class="font-bold text-slate-200">{{ row.name }}</div>
              <span class="inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px]" :class="STATUS_META[row.status].cls">
                {{ STATUS_META[row.status].label }}
              </span>
            </td>
            <!-- 公式 -->
            <td class="py-3 pr-3">
              <code class="text-cyan-300 break-all">{{ row.formula }}</code>
            </td>
            <!-- 说明 -->
            <td class="py-3 pr-3 text-slate-400 leading-relaxed">{{ row.description }}</td>
            <!-- 适用条件 -->
            <td class="py-3 pr-3">
              <div class="text-slate-400 leading-relaxed">{{ row.condition }}</div>
              <div class="mt-1 flex items-start gap-1" :class="row.conditionPass ? 'text-emerald-400' : 'text-amber-400'">
                <span>{{ row.conditionPass ? '✓ 满足' : '⚠ 偏离' }}</span>
                <span class="text-slate-500">{{ row.conditionDetail }}</span>
              </div>
            </td>
            <!-- 变量 -->
            <td class="py-3 pr-3">
              <div class="flex flex-wrap gap-1">
                <span v-for="v in row.vars" :key="v.symbol"
                  class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[11px]"
                  :class="varChipClass(v)">
                  <span class="font-bold">{{ v.symbol }}</span>
                  <template v-if="v.present">={{ fmtNum(v.display) }} {{ v.displayUnit }}</template>
                  <template v-else>=?</template>
                  <span v-if="v.present && v.baselineDisplay !== null && Math.abs((v.display ?? 0) - v.baselineDisplay) > 1e-12"
                    class="text-slate-500">(原 {{ fmtNum(v.baselineDisplay) }})</span>
                </span>
              </div>
              <div v-if="row.status === 'missing' || row.status === 'unit'"
                class="mt-1.5 text-red-400 leading-relaxed">原因：{{ row.reason }}</div>
              <div v-else-if="row.status === 'noresult'"
                class="mt-1.5 text-amber-400 leading-relaxed">原因：{{ row.reason }}</div>
              <div v-else-if="row.status === 'invalid'"
                class="mt-1.5 text-red-400 leading-relaxed">原因：{{ row.reason }}</div>
            </td>
            <!-- 调整前 -->
            <td class="py-3 pr-3 text-right tabular-nums">
              <span v-if="row.baselineValue !== null" class="text-slate-400">{{ fmtNum(row.baselineValue) }} {{ row.unit }}</span>
              <span v-else class="text-slate-600">—</span>
            </td>
            <!-- 当前理论值 -->
            <td class="py-3 pr-3 text-right tabular-nums">
              <span v-if="row.status === 'ok'" class="font-bold text-emerald-300">{{ fmtNum(row.value) }} {{ row.unit }}</span>
              <span v-else class="text-slate-600">无法计算</span>
            </td>
            <!-- 变化量 -->
            <td class="py-3 text-right tabular-nums">
              <span v-if="row.status === 'ok' && row.baselineValue !== null && row.value !== null">
                <span :class="deltaClass(row.value - row.baselineValue)">
                  {{ (row.value - row.baselineValue) >= 0 ? '+' : '' }}{{ fmtNum(row.value - row.baselineValue) }} mm
                </span>
                <span class="text-slate-500 block">
                  ({{ pct(row.value, row.baselineValue) }})
                </span>
              </span>
              <span v-else class="text-slate-600">—</span>
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
import {
  buildTheoryRows,
  EXPERIMENT_THEORY,
  STATUS_META,
  fmtNum,
  type ResolvedVar,
} from '../physics/theory'

const store = useOpticsStore()

const theoryMeta = computed(() => EXPERIMENT_THEORY[store.currentExperiment])
const baseline = computed(() => store.baselines[store.currentExperiment] ?? null)

const rows = computed(() =>
  buildTheoryRows(store.currentExperiment, store.params, store.theoryResult, baseline.value),
)

function varChipClass(v: ResolvedVar) {
  if (!v.present) return 'border-red-700 bg-red-900/40 text-red-300'
  if (!v.unitOk) return 'border-red-700 bg-red-900/40 text-red-300'
  return 'border-slate-700 bg-slate-900 text-slate-300'
}

function deltaClass(d: number) {
  if (Math.abs(d) < 1e-9) return 'text-slate-400'
  return d > 0 ? 'text-rose-400' : 'text-cyan-300'
}

function pct(cur: number, base: number) {
  if (Math.abs(base) < 1e-12) return '—'
  const p = ((cur - base) / base) * 100
  return `${p >= 0 ? '+' : ''}${fmtNum(p, 1)}%`
}
</script>
