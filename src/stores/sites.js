import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'

export const useSitesStore = defineStore('sites', () => {
  // State
  const sites = ref([])
  const currentSite = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const mySites = computed(() => {
    const authStore = useAuthStore()
    if (authStore.isAdmin) {
      return sites.value
    }
    return sites.value.filter(s => s.owner_id === authStore.user?.id)
  })

  // Actions
  async function fetchSites() {
    loading.value = true
    error.value = null
    
    try {
      const authStore = useAuthStore()
      let query = supabase.from('sites').select('*')
      
      if (!authStore.isAdmin) {
        query = query.eq('owner_id', authStore.user?.id)
      }
      
      const { data, error: err } = await query.order('created_at', { ascending: false })
      
      if (err) throw err
      sites.value = data || []
    } catch (err) {
      error.value = err.message
      console.error('Erreur fetch sites:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchSite(siteId) {
    loading.value = true
    try {
      const { data, error: err } = await supabase
        .from('sites')
        .select('*, site_views(*)')
        .eq('id', siteId)
        .single()
      
      if (err) throw err
      currentSite.value = data
      return data
    } catch (err) {
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function createSite(name) {
    const authStore = useAuthStore()
    
    try {
      const { data, error: err } = await supabase
        .from('sites')
        .insert({
          name,
          owner_id: authStore.user?.id,
          settings: {
            appearance: {
              primaryColor: '#6366f1',
              theme: 'dark'
            },
            login: {
              enabled: false,
              requireEmail: true
            },
            navigation: 'tabs' // 'tabs' ou 'menu'
          }
        })
        .select()
        .single()
      
      if (err) throw err
      
      // Créer la vue "Commun" par défaut
      await supabase.from('site_views').insert({
        site_id: data.id,
        name: 'Commun',
        type: 'common',
        order_index: 0,
        is_deletable: false,
        settings: {}
      })
      
      sites.value.unshift(data)
      return { success: true, site: data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function updateSite(siteId, updates) {
    try {
      const { data, error: err } = await supabase
        .from('sites')
        .update(updates)
        .eq('id', siteId)
        .select()
        .single()
      
      if (err) throw err
      
      const index = sites.value.findIndex(s => s.id === siteId)
      if (index !== -1) {
        sites.value[index] = data
      }
      if (currentSite.value?.id === siteId) {
        currentSite.value = { ...currentSite.value, ...data }
      }
      
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function deleteSite(siteId) {
    try {
      const { error: err } = await supabase
        .from('sites')
        .delete()
        .eq('id', siteId)
      
      if (err) throw err
      
      sites.value = sites.value.filter(s => s.id !== siteId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async function duplicateSite(siteId) {
    const site = sites.value.find(s => s.id === siteId)
    if (!site) return { success: false, error: 'Site non trouvé' }
    
    // Trouver le prochain numéro pour le nom
    const baseName = site.name.replace(/ \(\d+\)$/, '')
    const existingNumbers = sites.value
      .filter(s => s.name.startsWith(baseName))
      .map(s => {
        const match = s.name.match(/\((\d+)\)$/)
        return match ? parseInt(match[1]) : 0
      })
    const nextNumber = Math.max(...existingNumbers, 0) + 1
    const newName = `${baseName} (${nextNumber})`
    
    return await createSite(newName)
  }

  async function publishSite(siteId) {
    const slug = `site-${siteId.substring(0, 8)}`
    
    try {
      const { data, error: err } = await supabase
        .from('sites')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
          public_slug: slug
        })
        .eq('id', siteId)
        .select()
        .single()
      
      if (err) throw err
      
      const index = sites.value.findIndex(s => s.id === siteId)
      if (index !== -1) {
        sites.value[index] = data
      }
      
      return { success: true, url: `/p/${slug}` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  return {
    // State
    sites,
    currentSite,
    loading,
    error,
    // Getters
    mySites,
    // Actions
    fetchSites,
    fetchSite,
    createSite,
    updateSite,
    deleteSite,
    duplicateSite,
    publishSite
  }
})

