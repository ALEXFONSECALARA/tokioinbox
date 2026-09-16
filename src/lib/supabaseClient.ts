import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseFrontendConfigured = Boolean(url && anonKey);

if (!isSupabaseFrontendConfigured && typeof window !== 'undefined') {
  // Aviso claro em vez de falhar silenciosamente ou fingir que está tudo certo.
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configurados. ' +
      'Login real, cardápio multi-restaurante e realtime não vão funcionar até isso ser configurado (veja FASE1-2-SETUP.md).'
  );
}

/**
 * Client único do navegador. Usa a ANON KEY (pública) — a segurança real vem
 * das políticas de RLS no banco e da sessão do usuário (JWT), nunca de
 * "esconder" essa chave, que é pública por natureza no Supabase.
 */
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
