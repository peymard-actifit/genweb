import pg from 'pg'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  console.error('❌ Variable POSTGRES_URL non définie')
  process.exit(1)
}

const sql = `
-- Table des sessions de jeu
CREATE TABLE IF NOT EXISTS bridge_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES bridge_tables(id) ON DELETE CASCADE,
  current_deal_number INTEGER DEFAULT 1,
  total_deals_played INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(table_id)
);

-- Ajout de deal_number à bridge_games
ALTER TABLE bridge_games ADD COLUMN IF NOT EXISTS deal_number INTEGER DEFAULT 1;

-- Index
CREATE INDEX IF NOT EXISTS idx_bridge_sessions_table ON bridge_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_bridge_games_deal ON bridge_games(table_id, deal_number);

-- RLS
ALTER TABLE bridge_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Table players can view sessions" ON bridge_sessions;
CREATE POLICY "Table players can view sessions" ON bridge_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Table players can manage sessions" ON bridge_sessions;
CREATE POLICY "Table players can manage sessions" ON bridge_sessions FOR ALL USING (true);
`

async function updateSchema() {
  console.log('🔄 Mise à jour du schéma Bridge...')
  
  const client = new pg.Client({
    connectionString,
    ssl: true
  })

  try {
    await client.connect()
    console.log('✅ Connecté à Supabase')

    await client.query(sql)
    
    console.log('✅ Schéma Bridge mis à jour avec succès !')
    console.log('  - Table bridge_sessions créée')
    console.log('  - Colonne deal_number ajoutée à bridge_games')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
  } finally {
    await client.end()
    console.log('🔌 Déconnecté')
  }
}

updateSchema()
