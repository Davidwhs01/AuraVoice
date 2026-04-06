import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njihifoziuhzxcbsqpgj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qaWhpZm96aXVoenhjYnNxcGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDI5MDcsImV4cCI6MjA5MTAxODkwN30.AX6XzrZ4ce2IbSh4Wo1k4qDpSuw0dbwc5PHrz4mc_T4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export default supabase;
