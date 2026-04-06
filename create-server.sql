-- Criar Taverna da DKZ para usuário David
DO $$
DECLARE 
  server_uuid UUID;
  user_uuid UUID := 'afe2681a-6f0c-469a-b9b8-e07cb0cef98b';
  existing_server UUID;
BEGIN
  -- Verificar se usuário já tem servidor
  SELECT s.id INTO existing_server 
  FROM servers s 
  JOIN server_members sm ON s.id = sm.server_id 
  WHERE sm.user_id = user_uuid AND s.name = 'Taverna da DKZ'
  LIMIT 1;

  IF existing_server IS NULL THEN
    -- Criar servidor
    INSERT INTO servers (name, icon, color, owner_id)
    VALUES ('Taverna da DKZ', '🛡️', '#a855f7', user_uuid)
    RETURNING id INTO server_uuid;
    
    -- Canais de texto
    INSERT INTO channels (server_id, name, type, category, position) VALUES
      (server_uuid, 'geral', 'text', 'CANAL DE TEXTO', 0),
      (server_uuid, 'comandos', 'text', 'CANAL DE TEXTO', 1),
      (server_uuid, 'memes', 'text', 'CANAL DE TEXTO', 2);
    
    -- Canais de voz
    INSERT INTO channels (server_id, name, type, category, position) VALUES
      (server_uuid, 'Dois dedo de prosa', 'voice', 'CANAL DE VOZ', 0),
      (server_uuid, 'Sábios', 'voice', 'CANAL DE VOZ', 1),
      (server_uuid, 'Mal remunerados', 'voice', 'CANAL DE VOZ', 2),
      (server_uuid, 'Sonegadores', 'voice', 'CANAL DE VOZ', 3),
      (server_uuid, 'Aposentados', 'voice', 'CANAL DE VOZ', 4),
      (server_uuid, 'Jogando', 'voice', 'CANAL DE VOZ', 5),
      (server_uuid, 'Fortnai', 'voice', 'CANAL DE VOZ', 6);
    
    -- Adicionar membro
    INSERT INTO server_members (server_id, user_id, role)
    VALUES (server_uuid, user_uuid, 'owner');
    
    RAISE NOTICE 'Taverna da DKZ criada com ID: %', server_uuid;
  ELSE
    RAISE NOTICE 'Taverna da DKZ já existe para este usuário';
  END IF;
END;
$$;
