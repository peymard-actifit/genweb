import { createClient } from '@supabase/supabase-js'

// Variables d'environnement Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Vérification des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables d\'environnement manquantes. Configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
}

// Client Supabase
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)

// Helper pour vérifier la connexion
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('_test_connection').select('*').limit(1)
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist, ce qui est normal
      console.error('[Supabase] Erreur de connexion:', error.message)
      return false
    }
    console.log('[Supabase] Connexion établie')
    return true
  } catch (err) {
    console.error('[Supabase] Erreur:', err)
    return false
  }
}

// Export par défaut
export default supabase

