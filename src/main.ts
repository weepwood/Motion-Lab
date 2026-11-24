import { createApp, defineAsyncComponent } from 'vue'
import App from './App.vue'
import './style.css'

const workspace = new URLSearchParams(location.search).has('workspace')
createApp(workspace ? defineAsyncComponent(() => import('./workspace/Workspace.vue')) : App).mount('#app')
