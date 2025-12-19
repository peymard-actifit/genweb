<script setup>
import { ref, computed, watch } from 'vue'
import { useSitesStore } from '@/stores/sites'

const props = defineProps({
  site: {
    type: Object,
    default: null
  },
  activeView: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'selectView'])
const sitesStore = useSitesStore()

const expandedSections = ref(['site'])
const editedSiteName = ref('')
const editedViewName = ref('')
const saving = ref(false)
const savingView = ref(false)
const showDeleteConfirm = ref(false)

// Initialiser le nom du site
watch(() => props.site?.name, (newName) => {
  if (newName) editedSiteName.value = newName
}, { immediate: true })

// Initialiser le nom de la vue
watch(() => props.activeView?.name, (newName) => {
  if (newName) editedViewName.value = newName
}, { immediate: true })

const isCommonView = computed(() => props.activeView?.type === 'common')
const canModifyView = computed(() => props.activeView?.is_deletable !== false)

// Labels pour les types de vues
const viewTypeLabel = computed(() => {
  const types = {
    calculs: 'Calculs',
    media: 'Médias',
    gestion: 'Gestion',
    custom: 'Personnalisée'
  }
  return types[props.activeView?.type] || props.activeView?.type
})

// Titre dynamique : Site / Nom de la vue active
const sectionTitle = computed(() => {
  if (props.activeView?.name) {
    return `Site / ${props.activeView.name}`
  }
  return 'Site'
})

function toggleSection(section) {
  const index = expandedSections.value.indexOf(section)
  if (index > -1) {
    expandedSections.value.splice(index, 1)
  } else {
    expandedSections.value.push(section)
  }
}

function isSectionExpanded(section) {
  return expandedSections.value.includes(section)
}

async function saveSiteName() {
  if (!editedSiteName.value.trim() || !props.site) return
  
  saving.value = true
  await sitesStore.updateSite(props.site.id, { name: editedSiteName.value.trim() })
  saving.value = false
}

// Dupliquer la vue active
async function duplicateView() {
  if (!props.activeView || !props.site) return
  
  const baseName = props.activeView.name.replace(/ \(\d+\)$/, '')
  const views = props.site.site_views || []
  const existingNumbers = views
    .filter(v => v.name.startsWith(baseName))
    .map(v => {
      const match = v.name.match(/\((\d+)\)$/)
      return match ? parseInt(match[1]) : 0
    })
  const nextNumber = Math.max(...existingNumbers, 0) + 1
  const newName = `${baseName} (${nextNumber})`
  
  const result = await sitesStore.addView(props.site.id, props.activeView.type, newName)
  
  if (result.success && result.view) {
    emit('selectView', result.view.id)
  }
}

// Supprimer la vue active
async function deleteView() {
  if (!props.activeView) return
  
  const viewId = props.activeView.id
  const result = await sitesStore.deleteView(viewId)
  
  if (result.success) {
    // Sélectionner la première vue restante
    const remainingViews = (props.site?.site_views || []).filter(v => v.id !== viewId)
    if (remainingViews.length > 0) {
      emit('selectView', remainingViews[0].id)
    }
  }
  
  showDeleteConfirm.value = false
}

// Sauvegarder le nom de la vue
async function saveViewName() {
  if (!editedViewName.value.trim() || !props.activeView) return
  
  savingView.value = true
  await sitesStore.updateView(props.activeView.id, { name: editedViewName.value.trim() })
  savingView.value = false
}

// Basculer le statut publiable
async function togglePublishable(event) {
  if (!props.activeView) return
  
  const isPublishable = event.target.checked
  await sitesStore.updateView(props.activeView.id, { is_publishable: isPublishable })
}
</script>

<template>
  <aside class="edit-panel">
    <div class="panel-header">
      <h3>Édition</h3>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <!-- Section Site / Vue (toujours visible) -->
      <div class="section section-main">
        <div class="section-header-with-actions">
          <button class="section-header" @click="toggleSection('site')">
            <span class="section-icon">🏠</span>
            <span class="section-title">{{ sectionTitle }}</span>
            <!-- Boutons d'action pour la vue (sauf Commun) - à gauche de la flèche -->
            <div v-if="canModifyView" class="view-actions-inline">
              <button class="view-action-btn duplicate" @click.stop="duplicateView" title="Dupliquer la vue">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                  <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                </svg>
              </button>
              <button class="view-action-btn delete" @click.stop="showDeleteConfirm = true" title="Supprimer la vue">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('site') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        
        <!-- Popup de confirmation de suppression -->
        <div v-if="showDeleteConfirm" class="delete-confirm-overlay">
          <div class="delete-confirm-popup">
            <p>Supprimer "{{ activeView?.name }}" ?</p>
            <div class="delete-confirm-actions">
              <button class="btn-cancel" @click="showDeleteConfirm = false">Annuler</button>
              <button class="btn-delete" @click="deleteView">Supprimer</button>
            </div>
          </div>
        </div>
        <Transition name="expand">
          <div v-if="isSectionExpanded('site')" class="section-content">
            <div class="form-group">
              <label>Nom du site</label>
              <div class="input-with-btn">
                <input v-model="editedSiteName" type="text" placeholder="Nom du site" />
                <button 
                  class="save-btn" 
                  @click="saveSiteName" 
                  :disabled="saving || editedSiteName === site?.name"
                >
                  {{ saving ? '...' : '✓' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Sections pour la vue Commun -->
      <template v-if="isCommonView">
        <!-- Section Login -->
        <div class="section">
          <button class="section-header" @click="toggleSection('login')">
            <span class="section-icon">🔐</span>
            <span class="section-title">Login</span>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('login') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="expand">
            <div v-if="isSectionExpanded('login')" class="section-content">
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" />
                  <span>Activer l'authentification</span>
                </label>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" checked />
                  <span>Email requis</span>
                </label>
              </div>
              <p class="hint">Configuration de l'accès utilisateur au site publié</p>
            </div>
          </Transition>
        </div>

        <!-- Section Apparence -->
        <div class="section">
          <button class="section-header" @click="toggleSection('appearance')">
            <span class="section-icon">🎨</span>
            <span class="section-title">Apparence</span>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('appearance') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="expand">
            <div v-if="isSectionExpanded('appearance')" class="section-content">
              <div class="form-group">
                <label>Couleur principale</label>
                <div class="color-picker">
                  <input type="color" value="#6366f1" />
                  <span>#6366f1</span>
                </div>
              </div>
              <div class="form-group">
                <label>Thème</label>
                <select>
                  <option value="dark">Sombre</option>
                  <option value="light">Clair</option>
                </select>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Section Navigation -->
        <div class="section">
          <button class="section-header" @click="toggleSection('navigation')">
            <span class="section-icon">📑</span>
            <span class="section-title">Navigation</span>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('navigation') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="expand">
            <div v-if="isSectionExpanded('navigation')" class="section-content">
              <div class="form-group">
                <label>Type de navigation</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="nav" value="tabs" checked />
                    <span>Onglets</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="nav" value="menu" />
                    <span>Menu latéral</span>
                  </label>
                </div>
              </div>
              <p class="hint">Choix du mode de navigation entre les vues</p>
            </div>
          </Transition>
        </div>
      </template>

      <!-- Sections pour les autres vues -->
      <template v-else>
        <div class="section">
          <button class="section-header" @click="toggleSection('view-settings')">
            <span class="section-icon">⚙️</span>
            <span class="section-title">Paramètres de la vue</span>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('view-settings') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="expand">
            <div v-if="isSectionExpanded('view-settings')" class="section-content">
              <div class="form-group">
                <label>Nom de la vue</label>
                <div class="input-with-btn">
                  <input v-model="editedViewName" type="text" placeholder="Nom" />
                  <button 
                    class="save-btn" 
                    @click="saveViewName" 
                    :disabled="savingView || editedViewName === activeView?.name"
                  >
                    {{ savingView ? '...' : '✓' }}
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="checkbox-label publishable-toggle">
                  <input 
                    type="checkbox" 
                    :checked="activeView?.is_publishable" 
                    @change="togglePublishable"
                  />
                  <span>Publiable</span>
                  <span class="publishable-hint">Visible sur le site publié</span>
                </label>
              </div>
              <div class="form-group">
                <label class="type-label">Type: {{ viewTypeLabel }}</label>
              </div>
            </div>
          </Transition>
        </div>

        <div class="section">
          <button class="section-header" @click="toggleSection('elements')">
            <span class="section-icon">📦</span>
            <span class="section-title">Éléments</span>
            <svg class="chevron" :class="{ expanded: isSectionExpanded('elements') }" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="expand">
            <div v-if="isSectionExpanded('elements')" class="section-content">
              <p class="hint">Glissez-déposez des éléments pour construire votre vue</p>
              <div class="elements-grid">
                <button class="element-btn">📝 Texte</button>
                <button class="element-btn">🖼️ Image</button>
                <button class="element-btn">📊 Tableau</button>
                <button class="element-btn">📋 Liste</button>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.edit-panel {
  width: 300px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.section {
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  position: relative;
}

.section-main {
  overflow: visible;
}

.section-header-with-actions {
  display: flex;
  align-items: center;
}

.section-header-with-actions .section-header {
  flex: 1;
  border-radius: 0.5rem 0 0 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: none;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.section-header:hover {
  background: var(--bg-hover);
}

.section-icon {
  font-size: 1rem;
}

.section-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Actions sur la vue - inline à gauche de la flèche */
.view-actions-inline {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  margin-left: auto;
  margin-right: 0.25rem;
}

.view-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.view-action-btn svg {
  width: 16px;
  height: 16px;
}

.view-action-btn.duplicate {
  color: var(--text-muted);
}

.view-action-btn.duplicate:hover {
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
}

.view-action-btn.delete {
  color: var(--text-muted);
}

.view-action-btn.delete:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

/* Popup de confirmation */
.delete-confirm-overlay {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0.5rem;
}

.delete-confirm-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.875rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
}

.delete-confirm-popup p {
  font-size: 0.8125rem;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.delete-confirm-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-cancel, .btn-delete {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}

.btn-delete {
  background: #ef4444;
  border: none;
  color: white;
}

.btn-delete:hover {
  background: #dc2626;
}

.chevron {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.section-content {
  padding: 0.75rem;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 0.875rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.form-group input[type="text"],
.form-group select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.input-with-btn {
  display: flex;
  gap: 0.5rem;
}

.input-with-btn input {
  flex: 1;
}

.save-btn {
  padding: 0.5rem 0.75rem;
  background: var(--accent);
  border: none;
  border-radius: 0.375rem;
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.publishable-toggle {
  flex-wrap: wrap;
}

.publishable-hint {
  flex-basis: 100%;
  font-size: 0.6875rem;
  color: var(--text-muted);
  margin-left: 1.25rem;
  margin-top: 0.125rem;
}

.type-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-picker input[type="color"] {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  cursor: pointer;
}

.color-picker span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

.elements-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.element-btn {
  padding: 0.625rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.element-btn:hover {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

/* Expand animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}
</style>


