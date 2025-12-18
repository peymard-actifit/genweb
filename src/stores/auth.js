import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const profile = ref(null)
  const isAdmin = ref(false)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const userName = computed(() => profile.value?.name || user.value?.email || 'Utilisateur')

  // Actions
  async function initialize() {
    if (initialized.value) return
    
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user.value = session.user
        await fetchProfile()
      }
    } catch (err) {
      console.error('Erreur initialisation auth:', err)
    } finally {
      initialized.value = true
      loading.value = false
    }

    // Écouter les changements d'auth
    supabase.auth.onAuthStateChange(async (event, session) => {
      user.value = session?.user || null
      if (session?.user) {
        await fetchProfile()
      } else {
        profile.value = null
        isAdmin.value = false
      }
    })
  }

  async function fetchProfile() {
    if (!user.value) return
    
    try {
      const { data, error: err } = await supabase
        .from('studio_users')
        .select('*')
        .eq('id', user.value.id)
        .single()
      
      if (err && err.code !== 'PGRST116') throw err
      profile.value = data
    } catch (err) {
      console.error('Erreur fetch profile:', err)
    }
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (err) throw err
      
      user.value = data.user
      await fetchProfile()
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function register(name, email, password) {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      })
      
      if (err) throw err
      
      // Créer le profil utilisateur
      if (data.user) {
        await supabase.from('studio_users').insert({
          id: data.user.id,
          name,
          email
        })
      }
      
      user.value = data.user
      await fetchProfile()
      return { success: true }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
    isAdmin.value = false
  }

  async function updateProfile(updates) {
    if (!user.value) return { success: false }
    
    try {
      const { error: err } = await supabase
        .from('studio_users')
        .update(updates)
        .eq('id', user.value.id)
      
      if (err) throw err
      
      profile.value = { ...profile.value, ...updates }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  function enterAdminMode(code) {
    if (code === '12411241') {
      isAdmin.value = true
      return true
    }
    return false
  }

  function exitAdminMode() {
    isAdmin.value = false
  }

  return {
    // State
    user,
    profile,
    isAdmin,
    initialized,
    loading,
    error,
    // Getters
    isAuthenticated,
    userName,
    // Actions
    initialize,
    login,
    register,
    logout,
    updateProfile,
    enterAdminMode,
    exitAdminMode
  }
})


