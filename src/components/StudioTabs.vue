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
const showDeleteConfirm = ref(null) // ID de la vue à supprimer

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

async function duplicateView(view, event) {
  event.stopPropagation()
  
  // Trouver le prochain numéro pour le nom
  const baseName = view.name.replace(/ \(\d+\)$/, '')
  const existingNumbers = props.views
    .filter(v => v.name.startsWith(baseName))
    .map(v => {
      const match = v.name.match(/\((\d+)\)$/)
      return match ? parseInt(match[1]) : 0
    })
  const nextNumber = Math.max(...existingNumbers, 0) + 1
  const newName = `${baseName} (${nextNumber})`
  
  const result = await sitesStore.addView(props.siteId, view.type, newName)
  
  if (result.success && result.view) {
    emit('select', result.view.id)
  }
}

function confirmDelete(viewId, event) {
  event.stopPropagation()
  showDeleteConfirm.value = viewId
}

async function deleteView(viewId) {
  const result = await sitesStore.deleteView(viewId)
  
  if (result.success) {
    // Si la vue supprimée était active, sélectionner la première vue
    if (props.activeViewId === viewId && props.views.length > 1) {
      const remainingViews = props.views.filter(v => v.id !== viewId)
      if (remainingViews.length > 0) {
        emit('select', remainingViews[0].id)
      }
    }
  }
  
  showDeleteConfirm.value = null
}

function cancelDelete() {
  showDeleteConfirm.value = null
}
</script>

<template>
  <div class="studio-tabs">
    <!-- Onglets existants -->
    <div class="tabs-list">
      <div
        v-for="view in views"
        :key="view.id"
        class="tab-wrapper"
      >
        <button
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
          
          <!-- Actions (sauf pour la vue Commun) -->
          <div v-if="view.is_deletable !== false" class="tab-actions">
            <button 
              class="tab-action-btn duplicate" 
              @click="duplicateView(view, $event)"
              title="Dupliquer"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
              </svg>
            </button>
            <button 
              class="tab-action-btn delete" 
              @click="confirmDelete(view.id, $event)"
              title="Supprimer"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </button>
        
        <!-- Popup de confirmation de suppression -->
        <Transition name="popup">
          <div v-if="showDeleteConfirm === view.id" class="delete-confirm">
            <p>Supprimer "{{ view.name }}" ?</p>
            <div class="delete-confirm-actions">
              <button class="btn-cancel-delete" @click="cancelDelete">Annuler</button>
              <button class="btn-confirm-delete" @click="deleteView(view.id)">Supprimer</button>
            </div>
          </div>
        </Transition>
      </div>
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

    <!-- Backdrop pour menu d'ajout -->
    <div v-if="showAddMenu" class="backdrop" @click="showAddMenu = false"></div>
    
    <!-- Backdrop pour confirmation suppression -->
    <div v-if="showDeleteConfirm" class="backdrop" @click="cancelDelete"></div>
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

.tab-wrapper {
  position: relative;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
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

/* Actions sur les onglets */
.tab-actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  margin-left: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.tab:hover .tab-actions {
  opacity: 1;
}

.tab.active .tab-actions {
  opacity: 1;
}

.tab-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab-action-btn svg {
  width: 12px;
  height: 12px;
}

.tab-action-btn.duplicate {
  color: var(--text-muted);
}

.tab-action-btn.duplicate:hover {
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
}

.tab.active .tab-action-btn.duplicate {
  color: rgba(255, 255, 255, 0.7);
}

.tab.active .tab-action-btn.duplicate:hover {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.tab-action-btn.delete {
  color: var(--text-muted);
}

.tab-action-btn.delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.tab.active .tab-action-btn.delete {
  color: rgba(255, 255, 255, 0.7);
}

.tab.active .tab-action-btn.delete:hover {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.3);
}

/* Popup de confirmation de suppression */
.delete-confirm {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.75rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
  z-index: 200;
  white-space: nowrap;
}

.delete-confirm p {
  font-size: 0.8125rem;
  color: var(--text-primary);
  margin: 0 0 0.625rem 0;
}

.delete-confirm-actions {
  display: flex;
  gap: 0.375rem;
}

.btn-cancel-delete, .btn-confirm-delete {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-delete {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel-delete:hover {
  background: var(--bg-hover);
}

.btn-confirm-delete {
  background: #ef4444;
  border: none;
  color: white;
}

.btn-confirm-delete:hover {
  background: #dc2626;
}

/* Animation popup */
.popup-enter-active, .popup-leave-active {
  transition: all 0.15s ease;
}

.popup-enter-from, .popup-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-5px);
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


