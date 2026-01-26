<script setup lang="ts">
import type { Message } from '@/types/chat'
import MessageMedia from '@/components/MessageMedia.vue'
import VoiceMessage from '@/components/VoiceMessage.vue'

const props = defineProps<{
  message: Message
  isOwnMessage: boolean
}>()

const formattedTime = computed(() => {
  if (!props.message.createdAt?.toDate) return ''

  const date = props.message.createdAt.toDate()
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
})
</script>

<template>
  <div
    class="flex w-full"
    :class="isOwnMessage ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm"
      :class="
        isOwnMessage
          ? 'bg-indigo-600 text-white rounded-br-md'
          : 'bg-white text-slate-800 rounded-bl-md border border-slate-100'
      "
    >
      <p
        v-if="!isOwnMessage"
        class="text-xs font-semibold mb-1"
        :class="isOwnMessage ? 'text-indigo-200' : 'text-indigo-600'"
      >
        {{ message.username }}
      </p>

      <MessageMedia
        v-if="message.file"
        :file="message.file"
        :is-own-message="isOwnMessage"
        class="mb-2"
      />

      <VoiceMessage
        v-if="message.voice"
        :voice="message.voice"
        :is-own="isOwnMessage"
        class="mb-2"
      />

      <p
        v-if="message.text"
        class="text-sm sm:text-base break-words whitespace-pre-wrap"
      >
        {{ message.text }}
      </p>

      <p
        class="text-[10px] mt-1 text-right"
        :class="isOwnMessage ? 'text-indigo-200' : 'text-slate-400'"
      >
        {{ formattedTime }}
      </p>
    </div>
  </div>
</template>
