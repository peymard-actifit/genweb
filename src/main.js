import './style.css'
import { supabase, checkSupabaseConnection } from './lib/supabase.js'

console.log('🚀 Genweb initialized!')

// Vérifier la connexion Supabase au démarrage
checkSupabaseConnection().then(connected => {
  if (connected) {
    console.log('✅ Supabase prêt')
  } else {
    console.log('⚠️ Supabase non configuré ou non connecté')
  }
})

// Export pour utilisation dans d'autres modules
export { supabase }

