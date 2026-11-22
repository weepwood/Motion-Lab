<script setup lang="ts" generic="T extends string">
import { vRipple } from '../ripple'

defineProps<{ value: T; label: string; desc?: string; name: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <label v-ripple class="row radio-row">
    <input v-model="model" type="radio" :name="name" :value="value" />
    <span class="radio" aria-hidden="true"></span>
    <span class="row-text">
      <span class="row-title">{{ label }}</span>
      <small v-if="desc">{{ desc }}</small>
    </span>
  </label>
</template>
