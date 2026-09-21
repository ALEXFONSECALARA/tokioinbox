import React, { useState } from 'react';
import { Lock, User, KeyRound, Loader2 } from 'lucide-react';
import { BRAND_NAME } from '../config/brand';

interface StaffLoginProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

/** Tela de acesso da equipe. Sem credenciais de exemplo, sem atalhos, sem links para o cardápio. */
export const StaffLogin: React.FC<StaffLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    const res = await onLogin(username.trim(), password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Não foi possível entrar.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-[#0E121B] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-5"
        autoComplete="on"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-white tracking-tight">Acesso da equipe</h1>
          <p className="text-xs text-slate-400">{BRAND_NAME} • área restrita a colaboradores</p>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Usuário
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            className="w-full bg-[#07090E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Senha
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            required
            className="w-full bg-[#07090E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>

        {error && (
          <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl p-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] text-slate-950 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};
