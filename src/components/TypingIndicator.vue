<script setup lang="ts">
import { animate, stagger } from 'motion'
import { ref, watch, nextTick, onUnmounted } from 'vue' // Don't forget imports

const props = defineProps<{
  text: string
  visible: boolean
}>()

const dotsRef = ref<HTMLElement | null>(null)
let animation: ReturnType<typeof animate> | null = null

// --- 1. Define functions first ---

const stopAnimation = (): void => {
  if (animation) {
    animation.stop()
    animation = null
  }
}

const startAnimation = (): void => {
  if (!dotsRef.value) return

  const dots = dotsRef.value.querySelectorAll('.typing-dot')
  if (dots.length === 0) return

  // Stop any existing animation
  stopAnimation()

  // Create staggered bounce animation
  animation = animate(
      dots,
      {
        y: [0, -6, 0],
        opacity: [0.5, 1, 0.5],
      },
      {
        duration: 0.6,
        repeat: Infinity,
        delay: stagger(0.15),
        ease: [0.4, 0, 0.6, 1],
      }
  )
}

// --- 2. Then set up the watcher ---

// Start dot animation when visible
watch(
    () => props.visible,
    (isVisible) => {
      if (isVisible) {
        nextTick(() => {
          startAnimation()
        })
      }
      else {
        stopAnimation()
      }
    },
    { immediate: true }
)

onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <Transition name="typing-fade">
    <div
        v-if="visible"
        class="flex items-center gap-2 px-4 py-2"
    >
      <div
          ref="dotsRef"
          class="flex items-center justify-center gap-1 rounded-2xl px-3 py-2"
      >
        <span
            v-for="i in 3"
            :key="i"
            class="typing-dot w-2 h-2 bg-slate-400 rounded-full"
        />
      </div>

      <span class="text-sm text-slate-500 truncate max-w-[200px] sm:max-w-[300px]">
        {{ text }}
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.typing-fade-enter-active {
  transition: all 0.25s ease-out;
}

.typing-fade-leave-active {
  transition: all 0.2s ease-in;
}

.typing-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.typing-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.typing-dot {
  will-change: transform, opacity;
}
</style>
