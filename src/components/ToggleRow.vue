<script setup lang="ts">
import { vRipple } from '../ripple'

defineProps<{ label: string; desc?: string; disabled?: boolean; badge?: string; note?: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label v-ripple class="row toggle-row" :class="{ disabled }">
    <span class="row-text">
      <span class="row-title">{{ label }}<em v-if="badge" class="row-badge">{{ badge }}</em></span>
      <small v-if="note" class="row-note">{{ note }}</small>
      <small v-else-if="desc">{{ desc }}</small>
    </span>
    <slot name="extra" />
    <input v-model="model" type="checkbox" role="switch" :disabled="disabled" :aria-label="label" />
    <span class="switch" aria-hidden="true"></span>
  </label>
</template>
