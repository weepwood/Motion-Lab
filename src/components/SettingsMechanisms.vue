<script setup lang="ts">
import { settings, defaultMechanics, durationFor } from '../settings'
import type { Bezier } from '../motion'
import CurveEditor from './CurveEditor.vue'
import RangeSlider from './RangeSlider.vue'
import ToggleRow from './ToggleRow.vue'
const emit=defineEmits<{toast:[string]}>()
function mechDrag(target:'sendCurveX'|'sendCurveY'){return (value:Bezier)=>{settings.mech[target]=value}}
function resetMech(){settings.mech=defaultMechanics();emit('toast','机制参数已恢复 tweb 实测默认值')}
</script>
<template>
              <div class="settings-group">
                <h3 class="group-caption">机制参数 <small>tweb 手感的第一手数值</small> <button class="mini-btn" type="button" @click="resetMech">恢复默认</button></h3>
                <h4 class="group-caption sub">发送飞行 · tweb sendFlights</h4>
                <CurveEditor easing-key="custom" :bezier="settings.mech.sendCurveX" :bounce="0" :duration="durationFor('send')" :css="''" @drag="mechDrag('sendCurveX')" />
                <p class="group-hint">横向曲线 CURVE_X（快出）≈ cubic-bezier(.23,1,.32,1)</p>
                <CurveEditor easing-key="custom" :bezier="settings.mech.sendCurveY" :bounce="0" :duration="durationFor('send')" :css="''" @drag="mechDrag('sendCurveY')" />
                <p class="group-hint">纵向曲线 CURVE_Y（上抛更缓）≈ cubic-bezier(.1992,.0106,.2792,.9103)。两条曲线不同 → 气泡走出弧线；落位后交叉淡出 {{ settings.mech.sendLandFade }} ms。</p>
                <div class="slider-row"><RangeSlider v-model="settings.mech.sendLandFade" :min="0" :max="400" :step="10" label="落位淡出 ms" /><b class="slider-value">{{ settings.mech.sendLandFade }}</b></div>

                <h4 class="group-caption sub">表情飞行 · tweb reactionFlight</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.reactionElevation" :min="0" :max="120" :step="2" label="抛物线抬升 px" /><b class="slider-value">{{ settings.mech.reactionElevation }}</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.reactionLanding" :min="0.3" :max="1" :step="0.05" label="落点显影位置" /><b class="slider-value">{{ Math.round(settings.mech.reactionLanding * 100) }}%</b></div>

                <h4 class="group-caption sub">滑动回复 · tweb bubbles</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.swipeMax" :min="16" :max="200" :step="4" label="最大跟手位移 px" /><b class="slider-value">{{ settings.mech.swipeMax }} px</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.swipeTrigger" :min="0.2" :max="1" :step="0.05" label="触发阈值比例" /><b class="slider-value">{{ Math.round(settings.mech.swipeTrigger * settings.mech.swipeMax) }} px</b></div>

                <h4 class="group-caption sub">涟漪</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.rippleStart" :min="0" :max="1" :step="0.05" label="起始 scale" /><b class="slider-value">{{ settings.mech.rippleStart }}</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.rippleEnd" :min="1" :max="4" :step="0.1" label="结束 scale" /><b class="slider-value">{{ settings.mech.rippleEnd }}</b></div>

                <h4 class="group-caption sub">列推挤转场 · tweb slideNavigation</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.navParallax" :min="0" :max="60" :step="5" label="旧页视差 %" /><b class="slider-value">{{ settings.mech.navParallax }}%</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.navDim" :min="40" :max="100" :step="5" label="旧页亮度 %" /><b class="slider-value">{{ settings.mech.navDim }}%</b></div>

                <h4 class="group-caption sub">滚动锚点 · tweb scrollSaver</h4>
                <ToggleRow v-model="settings.mech.scrollAnchor" label="锚点补偿" desc="加载历史消息时保持视口钉在原消息上" />
              </div>


</template>
