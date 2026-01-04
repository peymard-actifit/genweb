-- ============================================================
-- SCHÉMA DE BASE DE DONNÉES SUPABASE - BRIDGE GENWEB
-- ============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase
-- Dashboard > SQL Editor > New Query > Coller ce script > Run
-- ============================================================

-- Table des tables de bridge
CREATE TABLE IF NOT EXISTS bridge_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'waiting', -- 'waiting', 'bidding', 'playing', 'finished'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des joueurs aux tables
CREATE TABLE IF NOT EXISTS bridge_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES bridge_tables(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  position CHAR(1) NOT NULL CHECK (position IN ('N', 'E', 'S', 'W')),
  is_ready BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_id, position),
  UNIQUE(table_id, user_id)
);

-- Table des parties de bridge
CREATE TABLE IF NOT EXISTS bridge_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES bridge_tables(id) ON DELETE CASCADE,
  dealer CHAR(1) NOT NULL CHECK (dealer IN ('N', 'E', 'S', 'W')),
  vulnerability VARCHAR(10) DEFAULT 'none', -- 'none', 'ns', 'ew', 'both'
  status VARCHAR(50) DEFAULT 'dealing', -- 'dealing', 'bidding', 'playing', 'finished'
  contract VARCHAR(10), -- ex: '4H', '3NT', '6S'
  declarer CHAR(1),
  tricks_ns INTEGER DEFAULT 0,
  tricks_ew INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Table des mains distribuées
CREATE TABLE IF NOT EXISTS bridge_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES bridge_games(id) ON DELETE CASCADE,
  position CHAR(1) NOT NULL CHECK (position IN ('N', 'E', 'S', 'W')),
  cards TEXT[] NOT NULL, -- ['AS', 'KH', '7D', ...]
  UNIQUE(game_id, position)
);

-- Table des enchères
CREATE TABLE IF NOT EXISTS bridge_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES bridge_games(id) ON DELETE CASCADE,
  position CHAR(1) NOT NULL CHECK (position IN ('N', 'E', 'S', 'W')),
  bid VARCHAR(10) NOT NULL, -- '1C', '2H', '3NT', 'Pass', 'Double', 'Redouble'
  bid_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des levées (tricks)
CREATE TABLE IF NOT EXISTS bridge_tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES bridge_games(id) ON DELETE CASCADE,
  trick_number INTEGER NOT NULL,
  leader CHAR(1) NOT NULL,
  cards JSONB NOT NULL, -- {"N": "AS", "E": "KS", "S": "QS", "W": "JS"}
  winner CHAR(1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table du chat
CREATE TABLE IF NOT EXISTS bridge_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES bridge_tables(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des sessions de jeu (historique de toutes les donnes d'une table)
CREATE TABLE IF NOT EXISTS bridge_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES bridge_tables(id) ON DELETE CASCADE,
  current_deal_number INTEGER DEFAULT 1,
  total_deals_played INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(table_id)
);

-- Ajout de deal_number à bridge_games pour traçabilité
ALTER TABLE bridge_games ADD COLUMN IF NOT EXISTS deal_number INTEGER DEFAULT 1;

-- ============================================================
-- INDEX POUR PERFORMANCES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bridge_tables_site ON bridge_tables(site_id);
CREATE INDEX IF NOT EXISTS idx_bridge_players_table ON bridge_players(table_id);
CREATE INDEX IF NOT EXISTS idx_bridge_players_user ON bridge_players(user_id);
CREATE INDEX IF NOT EXISTS idx_bridge_games_table ON bridge_games(table_id);
CREATE INDEX IF NOT EXISTS idx_bridge_hands_game ON bridge_hands(game_id);
CREATE INDEX IF NOT EXISTS idx_bridge_bids_game ON bridge_bids(game_id);
CREATE INDEX IF NOT EXISTS idx_bridge_tricks_game ON bridge_tricks(game_id);
CREATE INDEX IF NOT EXISTS idx_bridge_chat_table ON bridge_chat(table_id);
CREATE INDEX IF NOT EXISTS idx_bridge_sessions_table ON bridge_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_bridge_games_deal ON bridge_games(table_id, deal_number);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE bridge_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_tricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_sessions ENABLE ROW LEVEL SECURITY;

-- Policies pour bridge_tables (tout le monde peut voir les tables d'un site publié)
DROP POLICY IF EXISTS "Anyone can view tables" ON bridge_tables;
CREATE POLICY "Anyone can view tables" ON bridge_tables
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tables" ON bridge_tables;
CREATE POLICY "Authenticated users can create tables" ON bridge_tables
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Table creator can update" ON bridge_tables;
CREATE POLICY "Table creator can update" ON bridge_tables
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Table creator can delete" ON bridge_tables;
CREATE POLICY "Table creator can delete" ON bridge_tables
  FOR DELETE USING (auth.uid() = created_by);

-- Policies pour bridge_players
DROP POLICY IF EXISTS "Anyone can view players" ON bridge_players;
CREATE POLICY "Anyone can view players" ON bridge_players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join tables" ON bridge_players;
CREATE POLICY "Users can join tables" ON bridge_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own player" ON bridge_players;
CREATE POLICY "Users can update own player" ON bridge_players
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave tables" ON bridge_players;
CREATE POLICY "Users can leave tables" ON bridge_players
  FOR DELETE USING (auth.uid() = user_id);

-- Policies pour bridge_games
DROP POLICY IF EXISTS "Table players can view games" ON bridge_games;
CREATE POLICY "Table players can view games" ON bridge_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bridge_players 
      WHERE bridge_players.table_id = bridge_games.table_id 
      AND bridge_players.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Table players can create games" ON bridge_games;
CREATE POLICY "Table players can create games" ON bridge_games
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bridge_players 
      WHERE bridge_players.table_id = bridge_games.table_id 
      AND bridge_players.user_id = auth.uid()
    )
  );

-- Policies pour bridge_hands (un joueur ne peut voir que sa propre main)
DROP POLICY IF EXISTS "Players can view own hand" ON bridge_hands;
CREATE POLICY "Players can view own hand" ON bridge_hands
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bridge_players p
      JOIN bridge_games g ON g.table_id = p.table_id
      WHERE g.id = bridge_hands.game_id
      AND p.user_id = auth.uid()
      AND p.position = bridge_hands.position
    )
  );

-- Policies pour bridge_bids
DROP POLICY IF EXISTS "Table players can view bids" ON bridge_bids;
CREATE POLICY "Table players can view bids" ON bridge_bids
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can make bids" ON bridge_bids;
CREATE POLICY "Players can make bids" ON bridge_bids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bridge_players p
      JOIN bridge_games g ON g.table_id = p.table_id
      WHERE g.id = bridge_bids.game_id
      AND p.user_id = auth.uid()
      AND p.position = bridge_bids.position
    )
  );

-- Policies pour bridge_tricks
DROP POLICY IF EXISTS "Table players can view tricks" ON bridge_tricks;
CREATE POLICY "Table players can view tricks" ON bridge_tricks
  FOR SELECT USING (true);

-- Policies pour bridge_chat
DROP POLICY IF EXISTS "Anyone can view chat" ON bridge_chat;
CREATE POLICY "Anyone can view chat" ON bridge_chat
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can send messages" ON bridge_chat;
CREATE POLICY "Authenticated can send messages" ON bridge_chat
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies pour bridge_sessions
DROP POLICY IF EXISTS "Table players can view sessions" ON bridge_sessions;
CREATE POLICY "Table players can view sessions" ON bridge_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Table players can manage sessions" ON bridge_sessions;
CREATE POLICY "Table players can manage sessions" ON bridge_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bridge_players 
      WHERE bridge_players.table_id = bridge_sessions.table_id 
      AND bridge_players.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger pour updated_at sur bridge_tables
DROP TRIGGER IF EXISTS update_bridge_tables_updated_at ON bridge_tables;
CREATE TRIGGER update_bridge_tables_updated_at
  BEFORE UPDATE ON bridge_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Fonction pour générer un jeu de 52 cartes mélangé
CREATE OR REPLACE FUNCTION generate_shuffled_deck()
RETURNS TEXT[] AS $$
DECLARE
  suits TEXT[] := ARRAY['S', 'H', 'D', 'C'];
  ranks TEXT[] := ARRAY['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  deck TEXT[] := '{}';
  s TEXT;
  r TEXT;
BEGIN
  FOREACH s IN ARRAY suits
  LOOP
    FOREACH r IN ARRAY ranks
    LOOP
      deck := array_append(deck, r || s);
    END LOOP;
  END LOOP;
  
  -- Mélanger le deck
  SELECT array_agg(card ORDER BY random()) INTO deck
  FROM unnest(deck) AS card;
  
  RETURN deck;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MESSAGE DE CONFIRMATION
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Schéma Bridge Genweb créé avec succès !';
  RAISE NOTICE 'Tables: bridge_tables, bridge_players, bridge_games, bridge_hands, bridge_bids, bridge_tricks, bridge_chat, bridge_sessions';
  RAISE NOTICE 'RLS activé sur toutes les tables';
  RAISE NOTICE 'Historique complet des donnes activé';
END $$;
