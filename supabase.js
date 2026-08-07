import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://abopaplifnrruoxjfrgn.supabase.co'; // Cole sua URL exata aqui entre as aspas
const SUPABASE_ANON_KEY = 'sb_publishable_aF9Bv3DasCcCA7s3wDCgDg_GFOldXrw'; // Cole sua chave anon/public aqui entre as aspas

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);