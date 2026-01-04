import { createClient } from '@supabase/supabase-js'

// Variables d'environnement Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log de diagnostic (toujours affiché)
console.log('[Supabase] Configuration:')
console.log('[Supabase] URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NON DÉFINIE')
console.log('[Supabase] Key:', supabaseAnonKey ? 'définie (' + supabaseAnonKey.length + ' chars)' : 'NON DÉFINIE')

// Vérification des variables d'environnement
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] ❌ Variables d\'environnement manquantes!')
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

// ============================================================
// SCHÉMA DE BASE DE DONNÉES SUPABASE
// ============================================================
// Exécuter ce SQL dans l'éditeur SQL de Supabase :
/*

-- Table des utilisateurs du studio
CREATE TABLE IF NOT EXISTS studio_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des sites
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES studio_users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  public_slug VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des vues (onglets) d'un site
CREATE TABLE IF NOT EXISTS site_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'common', 'media', 'gestion', 'custom'
  order_index INTEGER DEFAULT 0,
  is_deletable BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des utilisateurs des sites publiés
CREATE TABLE IF NOT EXISTS site_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  UNIQUE(site_id, email)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(public_slug);
CREATE INDEX IF NOT EXISTS idx_site_views_site ON site_views(site_id);
CREATE INDEX IF NOT EXISTS idx_site_users_site ON site_users(site_id);

-- RLS (Row Level Security)
ALTER TABLE studio_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_users ENABLE ROW LEVEL SECURITY;

-- Policies pour studio_users
CREATE POLICY "Users can view own profile" ON studio_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON studio_users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON studio_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies pour sites
CREATE POLICY "Users can view own sites" ON sites
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own sites" ON sites
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own sites" ON sites
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own sites" ON sites
  FOR DELETE USING (auth.uid() = owner_id);

-- Policies pour site_views
CREATE POLICY "Users can manage views of own sites" ON site_views
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_views.site_id AND sites.owner_id = auth.uid())
  );

-- Policies pour site_users (accessible par le propriétaire du site)
CREATE POLICY "Site owners can manage site users" ON site_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_users.site_id AND sites.owner_id = auth.uid())
  );

*/

// Export par défaut
export default supabase
