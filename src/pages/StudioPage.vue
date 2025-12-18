<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSitesStore } from '@/stores/sites'
import HeaderBar from '@/components/HeaderBar.vue'
import StudioTabs from '@/components/StudioTabs.vue'
import EditPanel from '@/components/EditPanel.vue'
import ViewCommon from '@/components/views/ViewCommon.vue'
import ViewCustom from '@/components/views/ViewCustom.vue'

const route = useRoute()
const router = useRouter()
const sitesStore = useSitesStore()

const showEditPanel = ref(true)
const activeViewId = ref(null)

const siteId = computed(() => route.params.siteId)
const site = computed(() => sitesStore.currentSite)
const views = computed(() => site.value?.site_views || [])
const activeView = computed(() => views.value.find(v => v.id === activeViewId.value) || views.value[0])

onMounted(async () => {
  if (siteId.value) {
    await sitesStore.fetchSite(siteId.value)
    if (views.value.length > 0) {
      activeViewId.value = views.value[0].id
    }
  }
})

watch(siteId, async (newId) => {
  if (newId) {
    await sitesStore.fetchSite(newId)
    if (views.value.length > 0) {
      activeViewId.value = views.value[0].id
    }
  }
})

function selectView(viewId) {
  activeViewId.value = viewId
}

function toggleEditPanel() {
  showEditPanel.value = !showEditPanel.value
}

function goBack() {
  router.push('/sites')
}
</script>

<template>
  <div class="studio-page">
    <HeaderBar title="Studio Genweb" />

    <!-- Barre de navigation du site -->
    <div class="studio-nav">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
      </button>
      <span class="site-name">{{ site?.name || 'Chargement...' }}</span>
      <button class="toggle-panel-btn" @click="toggleEditPanel" :class="{ active: showEditPanel }">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
        Édition
      </button>
    </div>

    <!-- Onglets des vues -->
    <StudioTabs
      :views="views"
      :active-view-id="activeViewId"
      :site-id="siteId"
      @select="selectView"
    />

    <!-- Zone de travail -->
    <div class="studio-workspace" :class="{ 'panel-open': showEditPanel }">
      <!-- Zone de prévisualisation -->
      <main class="preview-area">
        <div class="preview-container">
          <!-- Vue Commun -->
          <ViewCommon v-if="activeView?.type === 'common'" :site="site" :view="activeView" />
          
          <!-- Vue Custom -->
          <ViewCustom v-else :site="site" :view="activeView" />
        </div>
      </main>

      <!-- Panel d'édition -->
      <Transition name="slide">
        <EditPanel
          v-if="showEditPanel"
          :site="site"
          :active-view="activeView"
          @close="showEditPanel = false"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.studio-page {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.studio-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.back-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.site-name {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-panel-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-panel-btn svg {
  width: 16px;
  height: 16px;
}

.toggle-panel-btn:hover {
  background: var(--bg-hover);
}

.toggle-panel-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.studio-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.preview-area {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.preview-container {
  min-height: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Animation du panel */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>


