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
    
    if (!authStore.user?.id) {
      return { success: false, error: 'Utilisateur non connecté' }
    }
    
    try {
      console.log('Creating site:', name, 'for user:', authStore.user.id)
      
      // Créer le site
      const { data: siteData, error: siteErr } = await supabase
        .from('sites')
        .insert({
          name,
          owner_id: authStore.user.id,
          settings: {
            appearance: {
              primaryColor: '#6366f1',
              theme: 'light'
            },
            login: {
              enabled: false,
              requireEmail: true
            },
            navigation: 'tabs'
          }
        })
        .select()
        .single()
      
      if (siteErr) {
        console.error('Erreur création site:', siteErr)
        throw siteErr
      }
      
      console.log('Site created:', siteData)
      
      // Créer la vue "Commun" par défaut
      const { error: viewErr } = await supabase.from('site_views').insert({
        site_id: siteData.id,
        name: 'Commun',
        type: 'common',
        order_index: 0,
        is_deletable: false,
        settings: {}
      })
      
      if (viewErr) {
        console.warn('Erreur création vue Commun:', viewErr)
        // On continue quand même, la vue pourra être créée plus tard
      }
      
      // Ajouter le site à la liste locale
      sites.value.unshift(siteData)
      
      return { success: true, site: siteData }
    } catch (err) {
      console.error('Erreur createSite:', err)
      return { success: false, error: err.message || 'Erreur lors de la création du site' }
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

  async function addView(siteId, viewType, viewName) {
    try {
      const existingViews = currentSite.value?.site_views || []
      const count = existingViews.filter(v => v.type === viewType).length
      const name = viewName || (count > 0 ? `${viewType} ${count + 1}` : viewType)
      
      const { data, error: err } = await supabase
        .from('site_views')
        .insert({
          site_id: siteId,
          name,
          type: viewType,
          order_index: existingViews.length,
          is_deletable: true,
          settings: {}
        })
        .select()
        .single()
      
      if (err) throw err
      
      // Mettre à jour le currentSite avec la nouvelle vue
      if (currentSite.value && currentSite.value.id === siteId) {
        currentSite.value = {
          ...currentSite.value,
          site_views: [...(currentSite.value.site_views || []), data]
        }
      }
      
      return { success: true, view: data }
    } catch (err) {
      console.error('Erreur création vue:', err)
      return { success: false, error: err.message }
    }
  }

  async function deleteView(viewId) {
    try {
      const { error: err } = await supabase
        .from('site_views')
        .delete()
        .eq('id', viewId)
      
      if (err) throw err
      
      // Mettre à jour le currentSite
      if (currentSite.value) {
        currentSite.value = {
          ...currentSite.value,
          site_views: currentSite.value.site_views.filter(v => v.id !== viewId)
        }
      }
      
      return { success: true }
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
    publishSite,
    addView,
    deleteView
  }
})
