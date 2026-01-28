import type { Ref } from 'vue'

export function useAutoScroll(containerRef: Ref<HTMLElement | null>) {
  const isNearBottom = ref(true)
  const scrollThreshold = 100
  let resizeObserver: ResizeObserver | null = null
  let lastScrollHeight = 0

  const checkIfNearBottom = (): void => {
    const container = containerRef.value
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    isNearBottom.value = scrollHeight - scrollTop - clientHeight < scrollThreshold
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth'): void => {
    const container = containerRef.value
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
  }

  const onScroll = (): void => {
    checkIfNearBottom()
  }

  const scrollToBottomIfNear = (): void => {
    if (isNearBottom.value) {
      nextTick(() => scrollToBottom())
    }
  }

  // Watch for content height changes (e.g., when images/videos load)
  const setupResizeObserver = (): void => {
    const container = containerRef.value
    if (!container || resizeObserver) return

    lastScrollHeight = container.scrollHeight

    resizeObserver = new ResizeObserver(() => {
      const currentScrollHeight = container.scrollHeight

      // Only act if content height actually changed
      if (currentScrollHeight !== lastScrollHeight) {
        const wasNearBottom = isNearBottom.value
        lastScrollHeight = currentScrollHeight

        // Re-scroll if user was near bottom before content changed
        if (wasNearBottom) {
          scrollToBottom('instant')
        }
      }
    })

    // Observe the container's first child (the content wrapper) for size changes
    // This detects when images/media load and change the content height
    if (container.firstElementChild) {
      resizeObserver.observe(container.firstElementChild)
    }
    // Also observe the container itself
    resizeObserver.observe(container)
  }

  const cleanupResizeObserver = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  // Setup observer when container is available
  watch(containerRef, (newContainer) => {
    cleanupResizeObserver()
    if (newContainer) {
      nextTick(() => setupResizeObserver())
    }
  }, { immediate: true })

  onUnmounted(() => {
    cleanupResizeObserver()
  })

  return {
    isNearBottom,
    scrollToBottom,
    scrollToBottomIfNear,
    onScroll,
  }
}
