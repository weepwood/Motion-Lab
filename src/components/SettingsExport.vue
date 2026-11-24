<script setup lang="ts">
import { computed, ref } from 'vue'
import { vRipple } from '../ripple'
import ToggleRow from './ToggleRow.vue'
import { buildEffectPrompt, buildSystemPrompt, exportableEffects, frameworkLabels, styleLabels, type EffectId, type Framework, type ImplStyle } from '../aiExport'
const emit = defineEmits<{ toast: [text: string] }>()
/* ---- AI 复刻导出 ---- */
const effects = exportableEffects()
const effectTarget = ref<EffectId>('send')
const framework = ref<Framework>('react')
const implStyle = ref<ImplStyle>('waapi')
const exportAll = ref(false)
const promptBox = ref<HTMLTextAreaElement | null>(null)

const options = computed(() => ({ framework: framework.value, style: implStyle.value }))
/**
 * 提示词是一份 computed：生成过程中读到的每一个配置量（基础时长、类别覆盖、
 * 机制参数、动画等级、省电模式、系统「减少动态效果」、电池状态……）都会被
 * 自动追踪，任何一个变动都会让提示词重算——不用手工维护依赖清单，也就不会
 * 出现「改了设置但导出的还是旧数值」。
 */
const promptText = computed(() => (exportAll.value
  ? buildSystemPrompt(options.value)
  : buildEffectPrompt(effectTarget.value, options.value)))

function copyPrompt() {
  const write = navigator.clipboard?.writeText(promptText.value)
  if (!write) {
    promptBox.value?.focus()
    promptBox.value?.select()
    emit('toast', '当前环境没有剪贴板权限，请全选复制文本框内容')
    return
  }
  void write.then(() => emit('toast', '提示词已复制，粘贴给 AI 即可复刻'), () => {
    promptBox.value?.focus()
    promptBox.value?.select()
    emit('toast', '浏览器拒绝了剪贴板，请全选复制文本框内容')
  })
}
function downloadPrompt() {
  const blob = new Blob([promptText.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (exportAll.value ? 'motion-lab-ai-system' : 'motion-lab-ai-' + effectTarget.value) + '.md'
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  // 立即 revoke 会让部分浏览器（Safari / 旧 Firefox）拿不到文件内容
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  emit('toast', '已下载 .md 文件')
}

</script>
<template>

              <div class="settings-group">
                <h3 class="group-caption">导出什么</h3>
                <ToggleRow v-model="exportAll" label="导出全套动效系统" desc="打开后一次性导出 12 个效果的完整规范（给 AI 做整套设计系统）" />
                <div v-if="!exportAll" class="chips" role="radiogroup" aria-label="选择要导出的动效">
                  <button v-for="e in effects" :key="e.id" v-ripple class="chip" role="radio" :aria-checked="effectTarget === e.id" :class="{ chosen: effectTarget === e.id }" @click="effectTarget = e.id">{{ e.title.split('（')[0] }}</button>
                </div>
                <p class="group-hint">
                  提示词由<b>当前实时配置</b>生成：基础时长、类别覆盖、机制参数（飞行曲线/阻尼/阈值……）都会写进去，
                  另附加机器可读 JSON 规范。把下面的文本复制或下载后交给任何 AI，即可在其他项目复现这个手感。
                </p>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">目标环境</h3>
                <div class="chips" role="radiogroup" aria-label="目标框架">
                  <button v-for="(label, key) in frameworkLabels" :key="key" v-ripple class="chip" role="radio" :aria-checked="framework === key" :class="{ chosen: framework === key }" @click="framework = key as Framework">{{ label }}</button>
                </div>
                <div class="chips" role="radiogroup" aria-label="实现方式">
                  <button v-for="(label, key) in styleLabels" :key="key" v-ripple class="chip" role="radio" :aria-checked="implStyle === key" :class="{ chosen: implStyle === key }" @click="implStyle = key as ImplStyle">{{ label }}</button>
                </div>
                <div class="chips">
                  <button v-ripple class="chip" @click="copyPrompt">复制提示词</button>
                  <button v-ripple class="chip" @click="downloadPrompt">下载 .md</button>
                </div>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">复刻提示词 <small>{{ promptText.length }} 字符</small></h3>
                <textarea ref="promptBox" class="config-io export-io" readonly :value="promptText" aria-label="AI 复刻提示词"></textarea>
              </div>
</template>
