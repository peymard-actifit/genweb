import pg from 'pg'

// Désactiver la vérification SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const connectionString = 'postgres://postgres.tfwvsfjsohbvubgovovf:K0TF5rYGELhO9UaJ@aws-1-eu-west-3.pooler.supabase.com:5432/postgres'

const sql = `
-- Corriger les politiques RLS pour permettre la creation de sites

-- Supprimer les anciennes politiques sur sites
DROP POLICY IF EXISTS "Users can insert own sites" ON sites;
DROP POLICY IF EXISTS "Authenticated users can insert sites" ON sites;
DROP POLICY IF EXISTS "Users can view own sites" ON sites;
DROP POLICY IF EXISTS "Users can update own sites" ON sites;
DROP POLICY IF EXISTS "Users can delete own sites" ON sites;
DROP POLICY IF EXISTS "Anyone can view published sites" ON sites;

-- Creer des politiques pour sites
CREATE POLICY "Authenticated users can insert sites" ON sites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view own sites" ON sites
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can update own sites" ON sites
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own sites" ON sites
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Corriger studio_users
DROP POLICY IF EXISTS "Users can insert own profile" ON studio_users;
DROP POLICY IF EXISTS "Users can view own profile" ON studio_users;
DROP POLICY IF EXISTS "Users can update own profile" ON studio_users;

CREATE POLICY "Users can insert own profile" ON studio_users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON studio_users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON studio_users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Corriger site_views
DROP POLICY IF EXISTS "Users can manage views of own sites" ON site_views;
DROP POLICY IF EXISTS "Anyone can view views of published sites" ON site_views;

CREATE POLICY "Users can manage views of own sites" ON site_views
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_views.site_id AND sites.owner_id = auth.uid())
  );
`

async function fixRLS() {
  console.log('Connexion a Supabase...')
  
  const client = new pg.Client({
    connectionString,
    ssl: true
  })

  try {
    await client.connect()
    console.log('Connecte')

    console.log('Application des corrections RLS...')
    await client.query(sql)
    
    console.log('Politiques RLS corrigees avec succes!')
    
  } catch (error) {
    console.error('Erreur:', error.message)
  } finally {
    await client.end()
    console.log('Deconnecte')
  }
}

fixRLS()

