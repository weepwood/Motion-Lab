<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ min: number; max: number; step?: number; label: string; disabled?: boolean; id?: string }>()
const model = defineModel<number>({ required: true })
const fill = computed(() => ((model.value - props.min) / (props.max - props.min)) * 100 + '%')
</script>

<template>
  <input
    :id="id"
    v-model.number="model"
    class="range"
    type="range"
    :min="min"
    :max="max"
    :step="step ?? 1"
    :aria-label="label"
    :disabled="disabled"
    :style="{ '--fill': fill }"
  />
</template>
