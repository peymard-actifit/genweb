import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Désactiver la vérification SSL pour les certificats auto-signés
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Utiliser la variable d'environnement POSTGRES_URL ou la définir manuellement
const connectionString = process.env.POSTGRES_URL || 'postgres://postgres.tfwvsfjsohbvubgovovf:YOUR_PASSWORD@aws-1-eu-west-3.pooler.supabase.com:5432/postgres'

async function setupDatabase() {
  console.log('Connexion a Supabase PostgreSQL...')
  
  const client = new pg.Client({
    connectionString,
    ssl: true
  })

  try {
    await client.connect()
    console.log('✅ Connecté à Supabase')

    // Lire le fichier SQL
    const sqlPath = join(__dirname, '..', 'supabase-schema.sql')
    const sql = readFileSync(sqlPath, 'utf8')

    console.log('🔄 Exécution du schéma SQL...')
    await client.query(sql)
    
    console.log('✅ Schéma créé avec succès !')
    console.log('')
    console.log('Tables créées :')
    console.log('  - studio_users')
    console.log('  - sites')
    console.log('  - site_views')
    console.log('  - site_users')
    
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

setupDatabase()

