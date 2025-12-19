-- ============================================================
-- SCHÉMA DE BASE DE DONNÉES SUPABASE - STUDIO GENWEB
-- ============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase
-- Dashboard > SQL Editor > New Query > Coller ce script > Run
-- ============================================================

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
  type VARCHAR(50) NOT NULL DEFAULT 'custom',
  order_index INTEGER DEFAULT 0,
  is_deletable BOOLEAN DEFAULT TRUE,
  is_publishable BOOLEAN DEFAULT FALSE,
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

-- ============================================================
-- INDEX POUR PERFORMANCES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(public_slug);
CREATE INDEX IF NOT EXISTS idx_sites_published ON sites(is_published);
CREATE INDEX IF NOT EXISTS idx_site_views_site ON site_views(site_id);
CREATE INDEX IF NOT EXISTS idx_site_views_order ON site_views(site_id, order_index);
CREATE INDEX IF NOT EXISTS idx_site_users_site ON site_users(site_id);
CREATE INDEX IF NOT EXISTS idx_site_users_email ON site_users(site_id, email);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE studio_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES POUR studio_users
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON studio_users;
CREATE POLICY "Users can view own profile" ON studio_users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON studio_users;
CREATE POLICY "Users can update own profile" ON studio_users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON studio_users;
CREATE POLICY "Users can insert own profile" ON studio_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLICIES POUR sites
-- ============================================================
DROP POLICY IF EXISTS "Users can view own sites" ON sites;
CREATE POLICY "Users can view own sites" ON sites
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own sites" ON sites;
CREATE POLICY "Users can insert own sites" ON sites
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own sites" ON sites;
CREATE POLICY "Users can update own sites" ON sites
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own sites" ON sites;
CREATE POLICY "Users can delete own sites" ON sites
  FOR DELETE USING (auth.uid() = owner_id);

-- Policy pour voir les sites publiés (public)
DROP POLICY IF EXISTS "Anyone can view published sites" ON sites;
CREATE POLICY "Anyone can view published sites" ON sites
  FOR SELECT USING (is_published = true);

-- ============================================================
-- POLICIES POUR site_views
-- ============================================================
DROP POLICY IF EXISTS "Users can manage views of own sites" ON site_views;
CREATE POLICY "Users can manage views of own sites" ON site_views
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_views.site_id AND sites.owner_id = auth.uid())
  );

-- Policy pour voir les vues des sites publiés
DROP POLICY IF EXISTS "Anyone can view views of published sites" ON site_views;
CREATE POLICY "Anyone can view views of published sites" ON site_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_views.site_id AND sites.is_published = true)
  );

-- ============================================================
-- POLICIES POUR site_users
-- ============================================================
DROP POLICY IF EXISTS "Site owners can manage site users" ON site_users;
CREATE POLICY "Site owners can manage site users" ON site_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sites WHERE sites.id = site_users.site_id AND sites.owner_id = auth.uid())
  );

-- ============================================================
-- FONCTION TRIGGER POUR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour auto-update de updated_at
DROP TRIGGER IF EXISTS update_studio_users_updated_at ON studio_users;
CREATE TRIGGER update_studio_users_updated_at
  BEFORE UPDATE ON studio_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_site_views_updated_at ON site_views;
CREATE TRIGGER update_site_views_updated_at
  BEFORE UPDATE ON site_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MESSAGE DE CONFIRMATION
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Schéma Genweb créé avec succès !';
  RAISE NOTICE 'Tables: studio_users, sites, site_views, site_users';
  RAISE NOTICE 'RLS activé sur toutes les tables';
END $$;


