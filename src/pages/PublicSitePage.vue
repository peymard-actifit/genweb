<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSitesStore } from '@/stores/sites'
import ViewCommon from '@/components/views/ViewCommon.vue'
import ViewCustom from '@/components/views/ViewCustom.vue'
import ViewDataExcel from '@/components/views/ViewDataExcel.vue'

const route = useRoute()
const sitesStore = useSitesStore()

const site = ref(null)
const loading = ref(true)
const error = ref(null)
const activeViewId = ref(null)

const slug = computed(() => route.params.slug)

// Vues publiables uniquement (excluant "common" de la navigation mais en gardant ses paramètres)
const publishedViews = computed(() => {
  if (!site.value?.site_views) return []
  return site.value.site_views.filter(v => v.type !== 'common')
})

const activeView = computed(() => {
  if (!activeViewId.value && publishedViews.value.length > 0) {
    return publishedViews.value[0]
  }
  return publishedViews.value.find(v => v.id === activeViewId.value) || publishedViews.value[0]
})

onMounted(async () => {
  await loadSite()
})

watch(slug, async () => {
  await loadSite()
})

async function loadSite() {
  if (!slug.value) {
    error.value = 'URL invalide'
    loading.value = false
    return
  }
  
  loading.value = true
  error.value = null
  
  const result = await sitesStore.fetchPublicSite(slug.value)
  
  if (result.success) {
    site.value = result.site
    if (publishedViews.value.length > 0) {
      activeViewId.value = publishedViews.value[0].id
    }
  } else {
    error.value = 'Site non trouvé ou non publié'
  }
  
  loading.value = false
}

function selectView(viewId) {
  activeViewId.value = viewId
}
</script>

<template>
  <div class="public-site">
    <!-- Chargement -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement du site...</p>
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <h2>{{ error }}</h2>
      <p>Vérifiez l'URL ou contactez l'administrateur du site.</p>
    </div>

    <!-- Site publié -->
    <template v-else-if="site">
      <!-- Header du site -->
      <header class="site-header">
        <h1 class="site-title">{{ site.name }}</h1>
        
        <!-- Navigation par onglets si plusieurs vues -->
        <nav v-if="publishedViews.length > 1" class="site-nav">
          <button
            v-for="view in publishedViews"
            :key="view.id"
            class="nav-tab"
            :class="{ active: view.id === activeView?.id }"
            @click="selectView(view.id)"
          >
            <span class="tab-icon" v-if="view.type === 'calculs'">🧮</span>
            <span class="tab-icon" v-else-if="view.type === 'media'">🖼️</span>
            <span class="tab-icon" v-else-if="view.type === 'gestion'">📊</span>
            <span class="tab-icon" v-else>✨</span>
            {{ view.name }}
          </button>
        </nav>
      </header>

      <!-- Contenu de la vue active -->
      <main class="site-content" :class="{ 'full-height': activeView?.type === 'calculs' }">
        <div class="view-container" :class="{ 'no-padding': activeView?.type === 'calculs' }">
          <!-- Vue Calculs -->
          <ViewDataExcel 
            v-if="activeView?.type === 'calculs'" 
            :site="site" 
            :view="activeView" 
          />
          
          <!-- Autres vues -->
          <ViewCustom 
            v-else 
            :site="site" 
            :view="activeView" 
          />
        </div>
      </main>

      <!-- Footer -->
      <footer class="site-footer">
        <p>Propulsé par <strong>Genweb</strong></p>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.public-site {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

/* États de chargement et erreur */
.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p,
.error-state p {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-state h2 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

/* Header du site */
.site-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 1.5rem;
}

.site-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.site-nav {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.tab-icon {
  font-size: 1rem;
}

/* Contenu */
.site-content {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

.site-content.full-height {
  padding: 0;
}

.view-container {
  height: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  overflow: hidden;
}

.view-container.no-padding {
  border: none;
  border-radius: 0;
}

/* Footer */
.site-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 0.75rem 1.5rem;
  text-align: center;
}

.site-footer p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.site-footer strong {
  color: var(--accent);
}
</style>


