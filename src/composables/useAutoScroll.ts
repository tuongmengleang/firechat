import type { Ref } from 'vue'

export function useAutoScroll(containerRef: Ref<HTMLElement | null>) {
  const isNearBottom = ref(true)
  const scrollThreshold = 100

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

  return {
    isNearBottom,
    scrollToBottom,
    scrollToBottomIfNear,
    onScroll,
  }
}
