<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  title: {
    type: String,
    default: 'Studio Genweb'
  },
  showCreateButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['create'])

const router = useRouter()
const authStore = useAuthStore()

const showUserMenu = ref(false)
const showProfileModal = ref(false)
const showAdminModal = ref(false)
const adminCode = ref('')
const adminError = ref('')

// Version du commit
const commitVersion = computed(() => {
  return import.meta.env.VITE_COMMIT_VERSION || 'v0.2.4'
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu() {
  showUserMenu.value = false
}

function openProfile() {
  showProfileModal.value = true
  closeUserMenu()
}

function openAdminModal() {
  if (authStore.isAdmin) {
    authStore.exitAdminMode()
    closeUserMenu()
  } else {
    showAdminModal.value = true
    adminCode.value = ''
    adminError.value = ''
    closeUserMenu()
  }
}

function submitAdminCode() {
  if (authStore.enterAdminMode(adminCode.value)) {
    showAdminModal.value = false
    adminCode.value = ''
    adminError.value = ''
  } else {
    adminError.value = 'Code incorrect'
  }
}

async function logout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="header-bar">
    <!-- Gauche: Version -->
    <div class="header-left">
      <span class="version-badge">{{ commitVersion }}</span>
    </div>

    <!-- Centre: Titre -->
    <div class="header-center">
      <h1 class="header-title">{{ title }}</h1>
    </div>

    <!-- Droite: Bouton créer + Menu utilisateur -->
    <div class="header-right">
      <!-- Bouton créer un site -->
      <button v-if="showCreateButton" class="create-btn" @click="emit('create')">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nouveau site
      </button>

      <!-- Menu utilisateur -->
      <div class="user-menu-container" @click.stop>
        <button class="user-btn" @click="toggleUserMenu">
          <span class="user-avatar">{{ authStore.userName.charAt(0).toUpperCase() }}</span>
          <span v-if="authStore.isAdmin" class="admin-badge">Admin</span>
          <svg class="chevron" :class="{ open: showUserMenu }" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <!-- Menu déroulant -->
        <Transition name="dropdown">
          <div v-if="showUserMenu" class="user-dropdown">
            <div class="dropdown-header">
              <span class="user-name-full">{{ authStore.userName }}</span>
            </div>
            <button class="dropdown-item" @click="openProfile">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
              Modifier le profil
            </button>
            <button class="dropdown-item" @click="openAdminModal">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              {{ authStore.isAdmin ? 'Quitter mode admin' : 'Mode administrateur' }}
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout" @click="logout">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
              </svg>
              Déconnexion
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Click outside pour fermer le menu -->
    <div v-if="showUserMenu" class="backdrop" @click="closeUserMenu"></div>
  </header>

  <!-- Modal Profil -->
  <Teleport to="body">
    <div v-if="showProfileModal" class="modal-overlay" @click.self="showProfileModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Modifier le profil</h2>
          <button class="close-btn" @click="showProfileModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p class="coming-soon">Fonctionnalité à venir</p>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modal Admin -->
  <Teleport to="body">
    <div v-if="showAdminModal" class="modal-overlay" @click.self="showAdminModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Mode administrateur</h2>
          <button class="close-btn" @click="showAdminModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitAdminCode">
            <div class="form-group">
              <label for="adminCode">Code administrateur</label>
              <input
                id="adminCode"
                v-model="adminCode"
                type="password"
                placeholder="Entrez le code"
                autofocus
              />
            </div>
            <div v-if="adminError" class="error-message">{{ adminError }}</div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="showAdminModal = false">Annuler</button>
              <button type="submit" class="btn-primary">Valider</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  position: relative;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.header-left,
.header-right {
  flex: 1;
  display: flex;
  align-items: center;
}

.header-right {
  justify-content: flex-end;
  gap: 1rem;
}

.header-center {
  flex: 2;
  text-align: center;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.version-badge {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  color: var(--text-muted);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent);
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-btn svg {
  width: 16px;
  height: 16px;
}

.create-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.user-menu-container {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.user-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
}

.admin-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  background: #f59e0b;
  border-radius: 0.25rem;
  color: white;
  text-transform: uppercase;
}

.chevron {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 220px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 200;
}

.dropdown-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.user-name-full {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dropdown-item svg {
  width: 18px;
  height: 18px;
}

.dropdown-item.logout {
  color: #ef4444;
}

.dropdown-item.logout:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dropdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.25rem 0;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 400px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
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
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 0.375rem;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
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
}

.btn-primary {
  padding: 0.625rem 1rem;
  background: var(--accent);
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.coming-soon {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem;
}
</style>
