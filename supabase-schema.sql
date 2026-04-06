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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read servers if member' AND tablename = 'servers') THEN
    CREATE POLICY "Read servers if member" ON servers FOR SELECT
      USING (id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Create servers' AND tablename = 'servers') THEN
    CREATE POLICY "Create servers" ON servers FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update own servers' AND tablename = 'servers') THEN
    CREATE POLICY "Update own servers" ON servers FOR UPDATE
      USING (owner_id = auth.uid() OR id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Delete own servers' AND tablename = 'servers') THEN
    CREATE POLICY "Delete own servers" ON servers FOR DELETE
      USING (owner_id = auth.uid());
  END IF;
END $$;

-- Server members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read members if member' AND tablename = 'server_members') THEN
    CREATE POLICY "Read members if member" ON server_members FOR SELECT
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Join server via invite' AND tablename = 'server_members') THEN
    CREATE POLICY "Join server via invite" ON server_members FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Remove members if admin' AND tablename = 'server_members') THEN
    CREATE POLICY "Remove members if admin" ON server_members FOR DELETE
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

-- Server invites
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read invites if member' AND tablename = 'server_invites') THEN
    CREATE POLICY "Read invites if member" ON server_invites FOR SELECT
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Create invites if admin' AND tablename = 'server_invites') THEN
    CREATE POLICY "Create invites if admin" ON server_invites FOR INSERT
      WITH CHECK (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Delete invites if admin' AND tablename = 'server_invites') THEN
    CREATE POLICY "Delete invites if admin" ON server_invites FOR DELETE
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

-- Channels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read channels if member' AND tablename = 'channels') THEN
    CREATE POLICY "Read channels if member" ON channels FOR SELECT
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Manage channels if admin' AND tablename = 'channels') THEN
    CREATE POLICY "Manage channels if admin" ON channels FOR ALL
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

-- Rooms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read rooms if member' AND tablename = 'rooms') THEN
    CREATE POLICY "Read rooms if member" ON rooms FOR SELECT
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Manage rooms if admin' AND tablename = 'rooms') THEN
    CREATE POLICY "Manage rooms if admin" ON rooms FOR ALL
      USING (server_id IN (SELECT server_id FROM server_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

-- Room users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for room_users' AND tablename = 'room_users') THEN
    CREATE POLICY "Allow all for room_users" ON room_users FOR ALL USING (true);
  END IF;
END $$;

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
