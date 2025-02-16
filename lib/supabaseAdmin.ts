// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Se você tiver a chave de service role, use-a (nunca exponha ela no front-end)
// Caso contrário, se não usar RLS na tabela, pode usar a anon key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
