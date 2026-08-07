import { createClient } from '@supabase/supabase-js'

// Substitua pelas suas credenciais reais que você pega no painel do Supabase (Project Settings > API)
const SUPABASE_URL = 'NEXT_PUBLIC_SUPABASE_URL=https://abopaplifnrruoxjfrgn.supabase.co'
const SUPABASE_ANON_KEY = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_aF9Bv3DasCcCA7s3wDCgDg_GFOldXrw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)