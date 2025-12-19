<script setup>
import { ref } from 'vue'
import { useSitesStore } from '@/stores/sites'

const props = defineProps({
  views: {
    type: Array,
    default: () => []
  },
  activeViewId: {
    type: String,
    default: null
  },
  siteId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select'])
const sitesStore = useSitesStore()

const showAddMenu = ref(false)
const isAdding = ref(false)

const viewTypes = [
  { type: 'calculs', name: 'Calculs', icon: '🧮', description: 'Import données + calculs IA' },
  { type: 'media', name: 'Médias', icon: '🖼️', description: 'Photos, vidéos, fichiers' },
  { type: 'gestion', name: 'Gestion', icon: '📊', description: 'Données et activités' },
  { type: 'custom', name: 'Personnalisée', icon: '✨', description: 'Vue libre' }
]

async function addView(viewType) {
  if (isAdding.value) return
  isAdding.value = true
  
  const count = props.views.filter(v => v.type === viewType.type).length
  const name = count > 0 ? `${viewType.name} ${count + 1}` : viewType.name
  
  const result = await sitesStore.addView(props.siteId, viewType.type, name)
  
  if (result.success && result.view) {
    emit('select', result.view.id)
  } else {
    console.error('Erreur lors de la création de la vue:', result.error)
  }
  
  showAddMenu.value = false
  isAdding.value = false
}
</script>

<template>
  <div class="studio-tabs">
    <!-- Onglets existants -->
    <div class="tabs-list">
      <button
        v-for="view in views"
        :key="view.id"
        class="tab"
        :class="{ active: view.id === activeViewId }"
        @click="emit('select', view.id)"
      >
        <span class="tab-icon" v-if="view.type === 'common'">⚙️</span>
        <span class="tab-icon" v-else-if="view.type === 'calculs'">🧮</span>
        <span class="tab-icon" v-else-if="view.type === 'media'">🖼️</span>
        <span class="tab-icon" v-else-if="view.type === 'gestion'">📊</span>
        <span class="tab-icon" v-else>✨</span>
        <span class="tab-name">{{ view.name }}</span>
      </button>
    </div>

    <!-- Bouton ajouter -->
    <div class="add-tab-container">
      <button class="add-tab-btn" @click="showAddMenu = !showAddMenu">
        <span>+</span>
      </button>

      <!-- Menu d'ajout -->
      <Transition name="dropdown">
        <div v-if="showAddMenu" class="add-menu">
          <div class="add-menu-header">Ajouter une vue</div>
          <button
            v-for="type in viewTypes"
            :key="type.type"
            class="add-menu-item"
            @click="addView(type)"
          >
            <span class="item-icon">{{ type.icon }}</span>
            <div class="item-info">
              <span class="item-name">{{ type.name }}</span>
              <span class="item-desc">{{ type.description }}</span>
            </div>
          </button>
        </div>
      </Transition>
    </div>

    <!-- Backdrop -->
    <div v-if="showAddMenu" class="backdrop" @click="showAddMenu = false"></div>
  </div>
</template>

<style scoped>
.studio-tabs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.tabs-list {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  padding: 0.5rem 0;
}

.tabs-list::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tab:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab.active {
  background: var(--accent);
  color: white;
}

.tab-icon {
  font-size: 0.875rem;
}

.add-tab-container {
  position: relative;
  margin-left: 0.5rem;
}

.add-tab-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-muted);
  font-size: 1.125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.add-tab-btn:hover {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.add-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 220px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 100;
}

.add-menu-header {
  padding: 0.625rem 0.875rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-color);
}

.add-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0.875rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.add-menu-item:hover {
  background: var(--bg-tertiary);
}

.item-icon {
  font-size: 1.25rem;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.item-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>


