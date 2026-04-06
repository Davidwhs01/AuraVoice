# AuraVoice 🎤

Chat de voz imersivo com servidores e transmissão de tela em 4K/120fps. Deployado no Vercel com Supabase Realtime.

## ✨ Funcionalidades

- 🔊 **Chat de Voz P2P** - Conexão direta entre usuários via WebRTC
- 🖥️ **Screen Share** - Transmissão de tela em até 4K 120fps
- 🎚️ **Volume por Usuário** - Controle individual de volume
- 🌟 **Tema Cósmico** - Design espacial com estrelas e efeitos neon
- ⚡ **Sem Servidor Próprio** - Funciona 100% no Vercel via Supabase

## 🚀 Deploy

### Pré-requisitos
- Conta no [Supabase](https://supabase.com) (gratuito)
- Conta no [Vercel](https://vercel.com) (gratuito)

### 1. Configurar Supabase

```bash
# Criar projeto no Supabase
# Vá em: SQL Editor

# Copie o conteúdo de supabase-schema.sql e execute
```

### 2. Configurar Variáveis de Ambiente

Crie `.env`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### 3. Deploy no Vercel

```bash
# Instalar dependências
npm install

# Build
npm run build

# Deploy (ou conecta pelo GitHub)
vercel
```

## 🛠️ Tecnologias

- **Frontend**: Vanilla JS, Vite, CSS3
- **Backend**: Supabase Realtime (WebRTC Signaling)
- **WebRTC**: P2P audio/video
- **Deploy**: Vercel

## 📱 Uso

1. Abra o app
2. Digite seu nome
3. Selecione um servidor e canal de voz
4. Conecte-se e converse!

## 📂 Estrutura

```
├── public/
│   ├── js/
│   │   ├── app.js        # App principal
│   │   ├── supabase.js  # Cliente Supabase
│   │   ├── realtime.js  # Realtime signaling
│   │   ├── webrtc.js    # WebRTC manager
│   │   └── ui.js        # Interface
│   ├── css/
│   │   └── styles.css   # Estilos
│   └── index.html
├── supabase-schema.sql  # Schema do banco
├── vite.config.js       # Config Vite
├── vercel.json         # Config deploy
└── package.json
```

## 📄 Licença

MIT
