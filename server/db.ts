import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Cliente com a Service Role Key: usado SOMENTE no backend, para operações
 * administrativas (criar usuário, ignorar RLS quando o próprio middleware já
 * validou a permissão). NUNCA exponha essa chave ao frontend.
 */
export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados nas variáveis de ambiente. ' +
        'Veja FASE1-SETUP.md para o passo a passo de criação do projeto Supabase.'
    );
  }
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAdminClient;
}

/**
 * Cliente "em nome do usuário": usa o JWT enviado pelo cliente (Authorization: Bearer <token>)
 * para que as políticas de RLS do Postgres sejam aplicadas exatamente como um usuário real
 * autenticado faria. Use isto para qualquer leitura/escrita que deva respeitar RLS diretamente
 * (ex: consultas feitas a pedido do usuário logado), em vez de usar sempre o client admin.
 */
export function getUserScopedClient(accessToken: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY precisam estar configurados nas variáveis de ambiente.');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_ANON_KEY);
}
