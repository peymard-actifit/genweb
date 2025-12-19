<script setup>
import { ref, reactive, computed } from 'vue'

const props = defineProps({
  site: {
    type: Object,
    default: null
  },
  view: {
    type: Object,
    default: null
  }
})

// Zone de données (partie haute)
const dataSources = ref([])
const isDraggingOver = ref(false)

// Zone tableau Excel (partie basse)
const spreadsheet = reactive({
  rows: 5,
  cols: 5,
  cells: {}
})

// Cellule sélectionnée pour édition du prompt
const selectedCell = ref(null)
const showPromptEditor = ref(false)

// Initialiser les cellules
function getCellKey(row, col) {
  const colLetter = String.fromCharCode(65 + col) // A, B, C...
  return `${colLetter}${row + 1}`
}

function getCellData(row, col) {
  const key = getCellKey(row, col)
  return spreadsheet.cells[key] || { prompt: '', value: '', isCalculating: false }
}

function setCellData(row, col, data) {
  const key = getCellKey(row, col)
  spreadsheet.cells[key] = { ...getCellData(row, col), ...data }
}

// Gestion des sources de données
function handleDragOver(e) {
  e.preventDefault()
  isDraggingOver.value = true
}

function handleDragLeave() {
  isDraggingOver.value = false
}

async function handleDrop(e) {
  e.preventDefault()
  isDraggingOver.value = false
  
  const files = Array.from(e.dataTransfer.files)
  for (const file of files) {
    await addDataSource(file)
  }
}

async function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  for (const file of files) {
    await addDataSource(file)
  }
  e.target.value = ''
}

async function addDataSource(file) {
  const source = {
    id: Date.now() + Math.random(),
    name: file.name,
    type: getFileType(file),
    size: formatFileSize(file.size),
    file: file,
    data: null,
    status: 'loading'
  }
  
  dataSources.value.push(source)
  
  // Lire le contenu du fichier
  try {
    const content = await readFileContent(file)
    source.data = content
    source.status = 'ready'
  } catch (err) {
    source.status = 'error'
    console.error('Erreur lecture fichier:', err)
  }
}

function getFileType(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (ext === 'csv') return 'csv'
  if (['eml', 'msg'].includes(ext)) return 'mail'
  if (ext === 'json') return 'json'
  if (ext === 'txt') return 'text'
  return 'other'
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    
    if (file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function removeDataSource(id) {
  dataSources.value = dataSources.value.filter(s => s.id !== id)
}

function getSourceIcon(type) {
  switch (type) {
    case 'excel': return '📊'
    case 'csv': return '📋'
    case 'mail': return '📧'
    case 'json': return '{ }'
    case 'text': return '📝'
    default: return '📁'
  }
}

// Gestion du tableau
function selectCell(row, col) {
  selectedCell.value = { row, col, key: getCellKey(row, col) }
  showPromptEditor.value = true
}

function addRow() {
  spreadsheet.rows++
}

function addColumn() {
  spreadsheet.cols++
}

function savePrompt(prompt) {
  if (selectedCell.value) {
    setCellData(selectedCell.value.row, selectedCell.value.col, { prompt })
  }
  showPromptEditor.value = false
}

// Exécution des prompts (simulation)
async function executeCell(row, col) {
  const cell = getCellData(row, col)
  if (!cell.prompt) return
  
  setCellData(row, col, { isCalculating: true })
  
  // Simulation - dans la vraie implémentation, on appellerait l'API OpenAI
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  setCellData(row, col, { 
    isCalculating: false, 
    value: `[Résultat calculé]` 
  })
}

async function executeAllCells() {
  for (let row = 0; row < spreadsheet.rows; row++) {
    for (let col = 0; col < spreadsheet.cols; col++) {
      const cell = getCellData(row, col)
      if (cell.prompt) {
        await executeCell(row, col)
      }
    }
  }
}

// Export Excel
function exportToExcel() {
  // Créer les données CSV (simple pour l'instant)
  let csv = ''
  
  // En-têtes
  for (let col = 0; col < spreadsheet.cols; col++) {
    csv += String.fromCharCode(65 + col)
    if (col < spreadsheet.cols - 1) csv += ','
  }
  csv += '\n'
  
  // Données
  for (let row = 0; row < spreadsheet.rows; row++) {
    for (let col = 0; col < spreadsheet.cols; col++) {
      const cell = getCellData(row, col)
      csv += `"${(cell.value || '').replace(/"/g, '""')}"`
      if (col < spreadsheet.cols - 1) csv += ','
    }
    csv += '\n'
  }
  
  // Télécharger
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${props.view?.name || 'export'}_${new Date().toISOString().slice(0,10)}.csv`
  link.click()
}

// Compteur de sources
const sourceCount = computed(() => dataSources.value.length)
const readySources = computed(() => dataSources.value.filter(s => s.status === 'ready').length)
</script>

<template>
  <div class="view-data-excel">
    <!-- PARTIE HAUTE : Sources de données -->
    <section class="data-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">📥</span>
          <h3>Sources de données</h3>
          <span class="badge" v-if="sourceCount > 0">{{ readySources }}/{{ sourceCount }}</span>
        </div>
        <div class="section-actions">
          <label class="btn-add-file">
            <input type="file" multiple @change="handleFileSelect" accept=".xlsx,.xls,.csv,.json,.txt,.eml" hidden />
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Ajouter fichier
          </label>
        </div>
      </div>
      
      <div 
        class="data-drop-zone"
        :class="{ 'dragging': isDraggingOver, 'has-sources': dataSources.length > 0 }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <!-- Zone vide -->
        <div v-if="dataSources.length === 0" class="drop-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p>Glissez vos fichiers ici</p>
          <span>Excel, CSV, JSON, Emails ou Texte</span>
        </div>
        
        <!-- Liste des sources -->
        <div v-else class="sources-list">
          <div 
            v-for="source in dataSources" 
            :key="source.id" 
            class="source-item"
            :class="{ 'loading': source.status === 'loading', 'error': source.status === 'error' }"
          >
            <span class="source-icon">{{ getSourceIcon(source.type) }}</span>
            <div class="source-info">
              <span class="source-name">{{ source.name }}</span>
              <span class="source-meta">{{ source.type.toUpperCase() }} • {{ source.size }}</span>
            </div>
            <div class="source-status">
              <span v-if="source.status === 'loading'" class="status-loading">⏳</span>
              <span v-else-if="source.status === 'ready'" class="status-ready">✓</span>
              <span v-else class="status-error">✗</span>
            </div>
            <button class="btn-remove" @click="removeDataSource(source.id)" title="Supprimer">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Séparateur redimensionnable -->
    <div class="section-divider">
      <span class="divider-handle"></span>
    </div>

    <!-- PARTIE BASSE : Tableau Excel -->
    <section class="excel-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">📊</span>
          <h3>Tableau de calcul</h3>
        </div>
        <div class="section-actions">
          <button class="btn-action" @click="addColumn" title="Ajouter colonne">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Colonne
          </button>
          <button class="btn-action" @click="addRow" title="Ajouter ligne">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Ligne
          </button>
          <button class="btn-execute" @click="executeAllCells">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
            Calculer tout
          </button>
          <button class="btn-export" @click="exportToExcel">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            Exporter Excel
          </button>
        </div>
      </div>
      
      <div class="spreadsheet-container">
        <table class="spreadsheet">
          <thead>
            <tr>
              <th class="row-header"></th>
              <th v-for="col in spreadsheet.cols" :key="col" class="col-header">
                {{ String.fromCharCode(64 + col) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in spreadsheet.rows" :key="row">
              <td class="row-header">{{ row }}</td>
              <td 
                v-for="col in spreadsheet.cols" 
                :key="col"
                class="cell"
                :class="{ 
                  'has-prompt': getCellData(row - 1, col - 1).prompt,
                  'calculating': getCellData(row - 1, col - 1).isCalculating,
                  'selected': selectedCell?.row === row - 1 && selectedCell?.col === col - 1
                }"
                @click="selectCell(row - 1, col - 1)"
              >
                <span v-if="getCellData(row - 1, col - 1).isCalculating" class="cell-loading">⏳</span>
                <span v-else-if="getCellData(row - 1, col - 1).value" class="cell-value">
                  {{ getCellData(row - 1, col - 1).value }}
                </span>
                <span v-else-if="getCellData(row - 1, col - 1).prompt" class="cell-prompt-indicator">
                  ƒ
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal d'édition du prompt -->
    <Transition name="modal">
      <div v-if="showPromptEditor" class="prompt-modal-overlay" @click.self="showPromptEditor = false">
        <div class="prompt-modal">
          <div class="prompt-modal-header">
            <h4>Prompt pour la cellule {{ selectedCell?.key }}</h4>
            <button class="btn-close" @click="showPromptEditor = false">×</button>
          </div>
          <div class="prompt-modal-body">
            <p class="prompt-help">
              Écrivez un prompt qui sera exécuté pour calculer la valeur de cette cellule.
              Vous pouvez référencer les données sources importées.
            </p>
            <textarea 
              class="prompt-textarea"
              :value="getCellData(selectedCell?.row, selectedCell?.col)?.prompt || ''"
              @input="(e) => setCellData(selectedCell.row, selectedCell.col, { prompt: e.target.value })"
              placeholder="Ex: Calcule la somme des ventes du fichier Excel pour le mois de janvier..."
              rows="6"
            ></textarea>
            <div class="data-refs">
              <span class="refs-label">Sources disponibles:</span>
              <div class="refs-list">
                <span v-for="source in dataSources" :key="source.id" class="ref-tag">
                  {{ source.name }}
                </span>
                <span v-if="dataSources.length === 0" class="no-refs">Aucune source importée</span>
              </div>
            </div>
          </div>
          <div class="prompt-modal-footer">
            <button class="btn-cancel" @click="showPromptEditor = false">Annuler</button>
            <button class="btn-save" @click="showPromptEditor = false">Enregistrer</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.view-data-excel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Sections */
section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.data-section {
  flex: 0 0 auto;
  max-height: 35%;
  min-height: 120px;
}

.excel-section {
  flex: 1 1 auto;
  min-height: 200px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  font-size: 1.125rem;
}

.section-title h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.badge {
  padding: 0.125rem 0.5rem;
  background: var(--accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
}

.section-actions {
  display: flex;
  gap: 0.5rem;
}

/* Boutons */
.btn-add-file, .btn-action, .btn-execute, .btn-export {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add-file {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-add-file:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-action {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-action:hover {
  background: var(--bg-hover);
}

.btn-execute {
  background: var(--accent);
  border: none;
  color: white;
}

.btn-execute:hover {
  opacity: 0.9;
}

.btn-export {
  background: #10b981;
  border: none;
  color: white;
}

.btn-export:hover {
  background: #059669;
}

.btn-add-file svg, .btn-action svg, .btn-execute svg, .btn-export svg {
  width: 14px;
  height: 14px;
}

/* Zone de drop */
.data-drop-zone {
  flex: 1;
  overflow: auto;
  padding: 0.75rem;
  transition: all 0.2s;
}

.data-drop-zone.dragging {
  background: rgba(99, 102, 241, 0.1);
  border: 2px dashed var(--accent);
}

.drop-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 80px;
  border: 2px dashed var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-muted);
}

.drop-placeholder svg {
  width: 32px;
  height: 32px;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.drop-placeholder p {
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0;
}

.drop-placeholder span {
  font-size: 0.75rem;
}

/* Liste des sources */
.sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  max-width: 250px;
}

.source-item.loading {
  opacity: 0.7;
}

.source-item.error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.source-icon {
  font-size: 1.25rem;
}

.source-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.source-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-meta {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.source-status {
  font-size: 0.875rem;
}

.status-ready { color: #10b981; }
.status-error { color: #ef4444; }

.btn-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
}

.source-item:hover .btn-remove {
  opacity: 1;
}

.btn-remove:hover {
  color: #ef4444;
}

.btn-remove svg {
  width: 14px;
  height: 14px;
}

/* Séparateur */
.section-divider {
  height: 6px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider-handle {
  width: 40px;
  height: 3px;
  background: var(--border-color);
  border-radius: 2px;
}

/* Tableau Excel */
.spreadsheet-container {
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
}

.spreadsheet {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.spreadsheet th, .spreadsheet td {
  border: 1px solid var(--border-color);
  padding: 0;
  text-align: center;
}

.col-header, .row-header {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.col-header {
  padding: 0.375rem 0;
  min-width: 80px;
}

.row-header {
  padding: 0.375rem 0.5rem;
  width: 40px;
}

.cell {
  height: 32px;
  min-width: 80px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.1s;
  position: relative;
}

.cell:hover {
  background: var(--bg-hover);
}

.cell.selected {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.cell.has-prompt {
  background: rgba(99, 102, 241, 0.1);
}

.cell.calculating {
  background: rgba(251, 191, 36, 0.2);
}

.cell-value {
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.cell-prompt-indicator {
  color: var(--accent);
  font-weight: 600;
  font-style: italic;
}

.cell-loading {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Modal prompt */
.prompt-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.prompt-modal {
  width: 90%;
  max-width: 600px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.prompt-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.prompt-modal-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.btn-close:hover {
  color: var(--text-primary);
}

.prompt-modal-body {
  padding: 1.25rem;
}

.prompt-help {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0 0 1rem 0;
}

.prompt-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
}

.prompt-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.data-refs {
  margin-top: 1rem;
}

.refs-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.refs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.ref-tag {
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.no-refs {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.prompt-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
}

.btn-cancel, .btn-save {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
}

.btn-cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-save {
  background: var(--accent);
  border: none;
  color: white;
}

/* Animations */
.modal-enter-active, .modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-from .prompt-modal, .modal-leave-to .prompt-modal {
  transform: scale(0.95);
}
</style>
