// Cliente Supabase — usado SOMENTE aqui no backend (server/). Nunca importe
// este arquivo em nada dentro de src/ (frontend): a SUPABASE_SERVICE_ROLE_KEY
// ignora Row Level Security por completo, então ela só pode existir no
// processo do servidor, nunca no bundle enviado pro navegador (ver seção 45
// do prompt mestre / server/lib/db.supabase.js pra como o isolamento por
// restaurante é garantido no código, já que a service role bypassa RLS).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Se as variáveis de ambiente não estiverem configuradas, `supabase` fica
// null e server/lib/db.js cai automaticamente pro backend em JSON (fallback
// da seção 49 do prompt mestre — nunca quebra o app em ambiente sem Supabase
// configurado, como dev local sem as chaves).
export const supabase = supabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!supabaseEnabled) {
  console.log('ℹ️  SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — usando o backend em arquivos JSON (server/data/).');
}
