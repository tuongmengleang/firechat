<script setup lang="ts">
const emit = defineEmits<{
  submit: [username: string]
}>()

const username = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  inputRef.value?.focus()
})

const handleSubmit = (): void => {
  const trimmed = username.value.trim()
  if (trimmed.length >= 2) {
    emit('submit', trimmed)
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <h2 class="text-xl font-bold text-slate-800 mb-2">Welcome to FireChat</h2>
      <p class="text-sm text-slate-500 mb-6">Enter your username to start chatting</p>

      <form @submit.prevent="handleSubmit">
        <input
          ref="inputRef"
          v-model="username"
          type="text"
          placeholder="Your username"
          minlength="2"
          maxlength="20"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 mb-4"
        />
        <button
          type="submit"
          :disabled="username.trim().length < 2"
          class="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Join Chat
        </button>
      </form>
    </div>
  </div>
</template>
