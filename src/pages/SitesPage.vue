<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSitesStore } from '@/stores/sites'
import HeaderBar from '@/components/HeaderBar.vue'
import SiteTile from '@/components/SiteTile.vue'
import ModalDialog from '@/components/ModalDialog.vue'

const router = useRouter()
const sitesStore = useSitesStore()

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const newSiteName = ref('')
const siteToDelete = ref(null)
const creating = ref(false)
const createError = ref('')

onMounted(async () => {
  await sitesStore.fetchSites()
})

async function createSite() {
  if (!newSiteName.value.trim()) return
  
  creating.value = true
  createError.value = ''
  
  const result = await sitesStore.createSite(newSiteName.value.trim())
  
  creating.value = false
  
  if (result.success) {
    showCreateModal.value = false
    newSiteName.value = ''
    // Ouvrir directement le site créé dans le studio
    router.push(`/studio/${result.site.id}`)
  } else {
    createError.value = result.error || 'Erreur lors de la création du site'
  }
}

function openCreateModal() {
  newSiteName.value = ''
  createError.value = ''
  showCreateModal.value = true
}

function openSite(siteId) {
  router.push(`/studio/${siteId}`)
}

function confirmDelete(site) {
  siteToDelete.value = site
  showDeleteModal.value = true
}

async function deleteSite() {
  if (!siteToDelete.value) return
  
  await sitesStore.deleteSite(siteToDelete.value.id)
  showDeleteModal.value = false
  siteToDelete.value = null
}

async function duplicateSite(siteId) {
  await sitesStore.duplicateSite(siteId)
}

async function publishSite(siteId) {
  await sitesStore.publishSite(siteId)
}
</script>

<template>
  <div class="sites-page">
    <HeaderBar title="Page de sélection des sites" @create="openCreateModal" :showCreateButton="true" />
    
    <main class="sites-content">
      <!-- Liste des sites -->
      <div class="sites-grid" v-if="sitesStore.mySites.length > 0">
        <SiteTile
          v-for="site in sitesStore.mySites"
          :key="site.id"
          :site="site"
          @open="openSite(site.id)"
          @delete="confirmDelete(site)"
          @duplicate="duplicateSite(site.id)"
          @publish="publishSite(site.id)"
        />
      </div>

      <!-- État vide -->
      <div v-else-if="!sitesStore.loading" class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>Aucun site</h3>
        <p>Créez votre premier site pour commencer</p>
      </div>

      <!-- Loading -->
      <div v-if="sitesStore.loading" class="loading">
        <div class="spinner"></div>
        <span>Chargement...</span>
      </div>
    </main>

    <!-- Modal création -->
    <ModalDialog
      :show="showCreateModal"
      title="Nouveau site"
      @close="showCreateModal = false"
    >
      <form @submit.prevent="createSite" class="create-form">
        <div class="form-group">
          <label for="siteName">Nom du site</label>
          <input
            id="siteName"
            v-model="newSiteName"
            type="text"
            placeholder="Mon nouveau site"
            autofocus
          />
        </div>
        
        <!-- Message d'erreur -->
        <div v-if="createError" class="error-message">
          {{ createError }}
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="showCreateModal = false">
            Annuler
          </button>
          <button type="submit" class="btn-primary" :disabled="!newSiteName.trim() || creating">
            {{ creating ? 'Création...' : 'Créer le site' }}
          </button>
        </div>
      </form>
    </ModalDialog>

    <!-- Modal suppression -->
    <ModalDialog
      :show="showDeleteModal"
      title="Supprimer le site"
      @close="showDeleteModal = false"
    >
      <div class="delete-confirm">
        <p>Êtes-vous sûr de vouloir supprimer <strong>{{ siteToDelete?.name }}</strong> ?</p>
        <p class="warning">Cette action est irréversible.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="showDeleteModal = false">
            Annuler
          </button>
          <button type="button" class="btn-danger" @click="deleteSite">
            Supprimer
          </button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.sites-page {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.sites-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.sites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 1rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-muted);
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 1rem;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary {
  padding: 0.625rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-primary {
  padding: 0.625rem 1rem;
  background: var(--accent);
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: 0.625rem 1rem;
  background: #ef4444;
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: #dc2626;
}

.delete-confirm p {
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.delete-confirm .warning {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}
</style>
