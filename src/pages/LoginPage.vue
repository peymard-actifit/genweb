<script setup>
/**
 * Page de connexion / inscription
 * Affiche la version de l'application
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Version de l'application (définie dans vite.config.js)
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?.?.?'

const router = useRouter()
const authStore = useAuthStore()

const isRegister = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const localError = ref('')

const canSubmit = computed(() => {
  if (isRegister.value) {
    return name.value && email.value && password.value && password.value === confirmPassword.value
  }
  return email.value && password.value
})

async function handleSubmit() {
  localError.value = ''
  
  if (isRegister.value) {
    if (password.value !== confirmPassword.value) {
      localError.value = 'Les mots de passe ne correspondent pas'
      return
    }
    const result = await authStore.register(name.value, email.value, password.value)
    if (result.success) {
      router.push('/sites')
    } else {
      localError.value = result.error
    }
  } else {
    const result = await authStore.login(email.value, password.value)
    if (result.success) {
      router.push('/sites')
    } else {
      localError.value = result.error
    }
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  localError.value = ''
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo et titre -->
      <div class="login-header">
        <div class="logo">
          <span class="logo-icon">◈</span>
          <span class="logo-text">Genweb</span>
        </div>
        <span class="version">v{{ appVersion }}</span>
        <h1>{{ isRegister ? 'Créer un compte' : 'Connexion' }}</h1>
        <p class="subtitle">Studio de création de sites web</p>
      </div>

      <!-- Formulaire -->
      <form @submit.prevent="handleSubmit" class="login-form">
        <!-- Nom (inscription uniquement) -->
        <div v-if="isRegister" class="form-group">
          <label for="name">Nom</label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Votre nom"
            autocomplete="name"
          />
        </div>

        <!-- Email -->
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            autocomplete="email"
          />
        </div>

        <!-- Mot de passe -->
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <!-- Confirmation mot de passe (inscription uniquement) -->
        <div v-if="isRegister" class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            autocomplete="new-password"
          />
        </div>

        <!-- Erreur -->
        <div v-if="localError || authStore.error" class="error-message">
          {{ localError || authStore.error }}
        </div>

        <!-- Bouton submit -->
        <button
          type="submit"
          class="submit-btn"
          :disabled="!canSubmit || authStore.loading"
        >
          <span v-if="authStore.loading" class="loader"></span>
          <span v-else>{{ isRegister ? 'Créer le compte' : 'Se connecter' }}</span>
        </button>
      </form>

      <!-- Toggle inscription/connexion -->
      <div class="toggle-mode">
        <span>{{ isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?' }}</span>
        <button type="button" @click="toggleMode" class="toggle-btn">
          {{ isRegister ? 'Se connecter' : 'Créer un compte' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
  padding: 1rem;
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  box-shadow: var(--shadow-xl);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.logo-icon {
  font-size: 2.5rem;
  color: var(--accent);
}

.logo-text {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--accent);
}

.version {
  display: block;
  font-size: 0.7rem;
  color: #999;
  margin-bottom: 1.5rem;
  letter-spacing: 0.5px;
}

.login-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
  text-align: center;
}

.submit-btn {
  padding: 0.875rem 1.5rem;
  background: var(--accent);
  border: none;
  border-radius: 0.5rem;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.toggle-mode {
  margin-top: 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-weight: 500;
  cursor: pointer;
  margin-left: 0.25rem;
}

.toggle-btn:hover {
  text-decoration: underline;
}
</style>
