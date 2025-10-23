import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Message = {
  id: string;
  session_id: string;
  role: 'user' | 'ai';
  content: string;
  feedback: string;
  created_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  role: string;
  scenario: string;
  score: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
};
