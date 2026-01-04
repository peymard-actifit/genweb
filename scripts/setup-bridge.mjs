import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Désactiver la vérification SSL pour les certificats auto-signés
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Utiliser la variable d'environnement POSTGRES_URL
const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  console.error('❌ Variable POSTGRES_URL non définie')
  console.log('Définissez-la avec : $env:POSTGRES_URL = "votre_url_postgres"')
  process.exit(1)
}

async function setupBridgeSchema() {
  console.log('🎴 Installation du schéma Bridge...')
  console.log('Connexion à Supabase PostgreSQL...')
  
  const client = new pg.Client({
    connectionString,
    ssl: true
  })

  try {
    await client.connect()
    console.log('✅ Connecté à Supabase')

    // Lire le fichier SQL
    const sqlPath = join(__dirname, '..', 'supabase-bridge-schema.sql')
    const sql = readFileSync(sqlPath, 'utf8')

    console.log('🔄 Exécution du schéma SQL Bridge...')
    await client.query(sql)
    
    console.log('')
    console.log('✅ Schéma Bridge créé avec succès !')
    console.log('')
    console.log('Tables créées :')
    console.log('  - bridge_tables')
    console.log('  - bridge_players')
    console.log('  - bridge_games')
    console.log('  - bridge_hands')
    console.log('  - bridge_bids')
    console.log('  - bridge_tricks')
    console.log('  - bridge_chat')
    console.log('')
    console.log('🎴 Vous pouvez maintenant créer des tables de Bridge !')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Les tables existent peut-être déjà.')
    }
  } finally {
    await client.end()
    console.log('🔌 Déconnecté')
  }
}

setupBridgeSchema()
