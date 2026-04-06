-- ============================================
-- AuraVoice - Supabase Database Schema
-- ============================================

-- ============================================
-- PROFILES (usuários) - ignore if already exists
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#7c3aed',
  bio TEXT DEFAULT '',
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'invisible')),
  status_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para profiles (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read profiles' AND tablename = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================
-- USER SETTINGS (configurações por usuário) - ignore if already exists
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_input TEXT DEFAULT 'default',
  audio_output TEXT DEFAULT 'default',
  video_input TEXT DEFAULT 'default',
  master_volume INTEGER DEFAULT 100,
  noise_suppression BOOLEAN DEFAULT false,
  echo_cancellation BOOLEAN DEFAULT true,
  notifications_sounds BOOLEAN DEFAULT true,
  notifications_desktop BOOLEAN DEFAULT false,
  privacy_allow_calls BOOLEAN DEFAULT true,
  privacy_allow_dms BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para settings (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read settings' AND tablename = 'user_settings') THEN
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can read settings" ON user_settings FOR SELECT USING (true);
    CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================
-- AVATARS STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies (ignore if already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view avatars' AND schemaname = 'storage' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own avatar' AND schemaname = 'storage' AND tablename = 'objects') THEN
    CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own avatar' AND schemaname = 'storage' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own avatar' AND schemaname = 'storage' AND tablename = 'objects') THEN
    CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- ============================================
-- AUTO CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '#7c3aed'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO user_settings (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- DROP OLD SERVER TABLES (migrate from TEXT to UUID)
-- ============================================
DROP TABLE IF EXISTS room_users CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS server_invites CASCADE;
DROP TABLE IF EXISTS server_members CASCADE;
DROP TABLE IF EXISTS servers CASCADE;

-- ============================================
-- SERVERS (criados por usuários, estilo Discord)
-- ============================================
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SERVER MEMBERS (quem pertence a cada servidor)
-- ============================================
CREATE TABLE IF NOT EXISTS server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  nickname TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, user_id)
);

-- ============================================
-- SERVER INVITES (links de convite estilo Discord)
-- ============================================
CREATE TABLE IF NOT EXISTS server_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_uses INTEGER DEFAULT 0,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHANNELS (canais de cada servidor)
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'text')),
  category TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOICE ROOMS
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  socket_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  is_muted BOOLEAN DEFAULT FALSE,
  is_deafened BOOLEAN DEFAULT FALSE,
  is_speaking BOOLEAN DEFAULT FALSE,
  is_screen_sharing BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REALTIME
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_users;
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_invites_code ON server_invites(code);
CREATE INDEX IF NOT EXISTS idx_server_invites_server ON server_invites(server_id);
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_rooms_server ON rooms(server_id);
CREATE INDEX IF NOT EXISTS idx_rooms_channel ON rooms(channel_id);
CREATE INDEX IF NOT EXISTS idx_room_users_room ON room_users(room_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_users ENABLE ROW LEVEL SECURITY;

-- Servers
DROP POLICY IF EXISTS "Read servers if member" ON servers;
DROP POLICY IF EXISTS "Create servers" ON servers;
DROP POLICY IF EXISTS "Update own servers" ON servers;
DROP POLICY IF EXISTS "Delete own servers" ON servers;

CREATE POLICY "Read servers if member" ON servers FOR SELECT
  USING (owner_id = auth.uid() OR id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));

CREATE POLICY "Create servers" ON servers FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Update own servers" ON servers FOR UPDATE
  USING (owner_id = auth.uid() OR id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Delete own servers" ON servers FOR DELETE
  USING (owner_id = auth.uid());

-- Server members
DROP POLICY IF EXISTS "Read members if member" ON server_members;
DROP POLICY IF EXISTS "Join server via invite" ON server_members;
DROP POLICY IF EXISTS "Remove members if admin" ON server_members;

CREATE POLICY "Read members if member" ON server_members FOR SELECT
  USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "Join server via invite" ON server_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Remove members if admin" ON server_members FOR DELETE
  USING (is_server_member(server_id, auth.uid()) AND get_user_role(server_id, auth.uid()) IN ('owner', 'admin'));

-- Server invites
DROP POLICY IF EXISTS "Read invites if member" ON server_invites;
DROP POLICY IF EXISTS "Create invites if admin" ON server_invites;
DROP POLICY IF EXISTS "Delete invites if admin" ON server_invites;

CREATE POLICY "Read invites if member" ON server_invites FOR SELECT
  USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "Create invites if admin" ON server_invites FOR INSERT
  WITH CHECK (is_server_member(server_id, auth.uid()) AND get_user_role(server_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Delete invites if admin" ON server_invites FOR DELETE
  USING (is_server_member(server_id, auth.uid()) AND get_user_role(server_id, auth.uid()) IN ('owner', 'admin'));

-- Channels
DROP POLICY IF EXISTS "Read channels if member" ON channels;
DROP POLICY IF EXISTS "Manage channels if admin" ON channels;

CREATE POLICY "Read channels if member" ON channels FOR SELECT
  USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "Manage channels if admin" ON channels FOR ALL
  USING (is_server_member(server_id, auth.uid()) AND get_user_role(server_id, auth.uid()) IN ('owner', 'admin'));

-- Rooms
DROP POLICY IF EXISTS "Read rooms if member" ON rooms;
DROP POLICY IF EXISTS "Manage rooms if admin" ON rooms;

CREATE POLICY "Read rooms if member" ON rooms FOR SELECT
  USING (is_server_member(server_id, auth.uid()));

CREATE POLICY "Manage rooms if admin" ON rooms FOR ALL
  USING (is_server_member(server_id, auth.uid()) AND get_user_role(server_id, auth.uid()) IN ('owner', 'admin'));

-- Room users
DROP POLICY IF EXISTS "Allow all for room_users" ON room_users;
CREATE POLICY "Allow all for room_users" ON room_users FOR ALL USING (true);


-- ============================================
-- AUTO CREATE DEFAULT CHANNELS ON SERVER CREATE
-- ============================================
CREATE OR REPLACE FUNCTION create_default_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO channels (server_id, name, type, category, position) VALUES
    (NEW.id, 'geral', 'text', 'CANAL DE TEXTO', 0),
    (NEW.id, 'Voz Geral', 'voice', 'CANAL DE VOZ', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_server_created ON servers;
CREATE TRIGGER on_server_created
  AFTER INSERT ON servers
  FOR EACH ROW EXECUTE FUNCTION create_default_channels();

-- ============================================
-- AUTO ADD OWNER AS MEMBER ON SERVER CREATE
-- ============================================
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_server_owner_created ON servers;
CREATE TRIGGER on_server_owner_created
  AFTER INSERT ON servers
  FOR EACH ROW EXECUTE FUNCTION add_owner_as_member();

-- ============================================
-- SEED FUNCTION: Create Taverna da DKZ for user
-- ============================================
CREATE OR REPLACE FUNCTION create_taverna_for_user()
RETURNS VOID AS $$
DECLARE
  user_uuid UUID := 'afe2681a-6f0c-469a-b9b8-e07cb0cef98b';
  server_id UUID;
BEGIN
  -- Create server with UUID
  INSERT INTO servers (id, name, icon, color, owner_id)
  VALUES (gen_random_uuid(), 'Taverna da DKZ', '🛡️', '#a855f7', user_uuid)
  RETURNING id INTO server_id;
  
  -- Create channels
  INSERT INTO channels (server_id, name, type, category, position) VALUES
    -- STAFF
    (server_id, '💬 | chat-equipe', 'text', 'STAFF', 0),
    (server_id, '🤖 | comandos-equipe', 'text', 'STAFF', 1),
    (server_id, '👁️ | referência-visual', 'text', 'STAFF', 2),
    (server_id, '📚 | guias', 'text', 'STAFF', 3),
    (server_id, 'Hablas', 'voice', 'STAFF', 4),
    
    -- IMPORTANTE
    (server_id, '📜 | regras', 'text', 'IMPORTANTE', 5),
    (server_id, '📣 | anuncios', 'text', 'IMPORTANTE', 6),
    (server_id, '👋 | boas-vindas', 'text', 'IMPORTANTE', 7),
    
    -- Comunidade
    (server_id, '💬 | chat', 'text', 'Comunidade', 8),
    (server_id, '🤖 | comandos', 'text', 'Comunidade', 9),
    (server_id, '🎃 | memes', 'text', 'Comunidade', 10),
    
    -- CALLS
    (server_id, 'Dois dedo de prosa', 'voice', 'CALLS', 11),
    (server_id, 'Sábios', 'voice', 'CALLS', 12),
    (server_id, 'Mal remunerados', 'voice', 'CALLS', 13),
    (server_id, 'Sonegadores', 'voice', 'CALLS', 14),
    (server_id, 'Aposentados', 'voice', 'CALLS', 15),
    (server_id, 'Só o pó da rabiola', 'voice', 'CALLS', 16),
    (server_id, 'Jogando', 'voice', 'CALLS', 17),
    (server_id, 'Jogando II', 'voice', 'CALLS', 18),
    (server_id, 'Jogando III', 'voice', 'CALLS', 19),
    (server_id, 'Jogando IV', 'voice', 'CALLS', 20),
    (server_id, 'Amongas', 'voice', 'CALLS', 21),
    (server_id, 'Fortnai', 'voice', 'CALLS', 22),
    (server_id, 'COD', 'voice', 'CALLS', 23),
    (server_id, 'Tombou', 'voice', 'CALLS', 24);
  
  -- The trigger add_owner_as_member will automatically add the user as owner
  
  RAISE NOTICE 'Taverna da DKZ created for user %', user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
