import { createApp } from 'vue'
import './style.css'

// Use E2EE version by default
// Set VITE_USE_PUBLIC_CHAT=true to use the old public chat
const usePublicChat = import.meta.env.VITE_USE_PUBLIC_CHAT === 'true'

async function initApp() {
  const AppComponent = usePublicChat
    ? (await import('./App.vue')).default
    : (await import('./AppEncrypted.vue')).default

  createApp(AppComponent).mount('#app')
}

initApp()
