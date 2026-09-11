import React, { useEffect, useState } from 'react';
import { AdminUser, RestaurantSummary, fetchAdminUsers, createAdminUser, updateAdminUser, fetchAdminCustomers, deleteAdminCustomer, CustomerAdmin } from '../utils/api';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from '../utils/permissions';
import { Users, Plus, X, Check, ShieldCheck, KeyRound, Power } from 'lucide-react';

// "🔒 Usuários e Permissões" (Fase 4, itens 17-19): cria/edita usuários
// individuais do painel, cada um com login+senha próprios, vinculados (ou
// não) a um restaurante, com uma grade de permissões granulares em vez de
// depender só de um "cargo" fixo. Convive com o login mestre por senha
// única, que continua funcionando exatamente como sempre — este painel é
// aditivo.
interface UserFormState {
  id?: string;
  name: string;
  login: string;
  password: string;
  restaurantSlug: string;
  role: string;
  active: boolean;
  permissions: Record<string, boolean>;
}

const EMPTY_FORM: UserFormState = {
  name: '',
  login: '',
  password: '',
  restaurantSlug: '',
  role: 'operador',
  active: true,
  permissions: {},
};

export const AdminUsersPanel: React.FC<{ token: string; restaurants: RestaurantSummary[] }> = ({
  token,
  restaurants,
}) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customers, setCustomers] = useState<CustomerAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetPasswordFor, setResetPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadCustomers = () => { fetchAdminCustomers(token).then(setCustomers).catch(() => {}); };

  const loadUsers = () => {
    setLoading(true);
    setError(null);
    fetchAdminUsers(token)
      .then(setUsers)
      .catch((err) => setError(err.message || 'Não foi possível carregar os usuários.'))
      .finally(() => { setLoading(false); loadCustomers(); });
  };

  useEffect(() => {
    if (open) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const togglePermission = (form: UserFormState, key: string): UserFormState => ({
    ...form,
    permissions: { ...form.permissions, [key]: !form.permissions[key] },
  });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim() || (!editing.id && (!editing.login.trim() || !editing.password))) return;
    setSaving(true);
    setError(null);
    try {
      if (editing.id) {
        await updateAdminUser(token, editing.id, {
          name: editing.name.trim(),
          restaurantSlug: editing.restaurantSlug || null,
          role: editing.role,
          active: editing.active,
          permissions: editing.permissions,
        });
      } else {
        await createAdminUser(token, {
          name: editing.name.trim(),
          login: editing.login.trim(),
          password: editing.password,
          restaurantSlug: editing.restaurantSlug || null,
          role: editing.role,
          permissions: editing.permissions,
        });
      }
      setEditing(null);
      loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      await updateAdminUser(token, user.id, { active: !user.active });
      loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível alterar o status do usuário.');
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!newPassword) return;
    try {
      await updateAdminUser(token, id, { newPassword });
      setResetPasswordFor(null);
      setNewPassword('');
      loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível redefinir a senha.');
    }
  };

  return (
    <div className="bg-stone-800 border-t border-stone-700">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-300 hover:text-white"
      >
        <Users size={14} /> Usuários e Permissões
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-3">{error}</div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-stone-400 text-xs">
              Contas individuais de acesso ao painel, com permissões próprias. O login por senha única continua
              funcionando normalmente para o super-admin.
            </p>
            <button
              onClick={() => setEditing({ ...EMPTY_FORM })}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold whitespace-nowrap"
            >
              <Plus size={14} /> Adicionar usuário
            </button>
          </div>

          {loading && <p className="text-stone-500 text-xs">Carregando...</p>}

          {!loading && (
            <div className="space-y-2">
              {users.length === 0 && <p className="text-stone-500 text-xs">Nenhum usuário individual cadastrado ainda.</p>}
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 bg-stone-900/60 border border-stone-700 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                      {!u.active && (
                        <span className="text-[10px] font-bold text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-stone-400 text-xs truncate">
                      @{u.login} · {u.role} ·{' '}
                      {u.restaurantSlug
                        ? restaurants.find((r) => r.slug === u.restaurantSlug)?.name || u.restaurantSlug
                        : 'Todos os restaurantes'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setEditing({
                          id: u.id,
                          name: u.name,
                          login: u.login,
                          password: '',
                          restaurantSlug: u.restaurantSlug || '',
                          role: u.role,
                          active: u.active,
                          permissions: u.permissions || {},
                        })
                      }
                      className="p-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white"
                      title="Editar permissões"
                    >
                      <ShieldCheck size={14} />
                    </button>
                    <button
                      onClick={() => setResetPasswordFor(u.id)}
                      className="p-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white"
                      title="Redefinir senha"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`p-2 rounded-lg text-white ${u.active ? 'bg-red-600/70 hover:bg-red-600' : 'bg-emerald-600/70 hover:bg-emerald-600'}`}
                      title={u.active ? 'Desativar' : 'Ativar'}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-stone-700 space-y-3">
            <div>
              <h3 className="text-white text-sm font-black">Clientes globais</h3>
              <p className="text-stone-400 text-xs mt-1">Uma única conta de cliente funciona em todos os restaurantes. Exclusão disponível somente para o super-admin.</p>
            </div>
            {customers.length === 0 ? <p className="text-stone-500 text-xs">Nenhum cliente cadastrado.</p> : customers.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-stone-900/60 border border-stone-700 rounded-xl px-4 py-3">
                <div className="min-w-0"><p className="text-white text-sm font-semibold truncate">{c.name}</p><p className="text-stone-400 text-xs truncate">{c.phone}{c.email ? ` · ${c.email}` : ''}</p></div>
                <button onClick={async()=>{if(!window.confirm(`Excluir a conta de ${c.name}? Os pedidos históricos serão mantidos, mas deixarão de estar vinculados à conta.`))return;try{await deleteAdminCustomer(token,c.id);loadCustomers()}catch(err:any){setError(err?.message||'Não foi possível excluir o cliente.')}}} className="p-2 rounded-lg bg-red-600/70 hover:bg-red-600 text-white" title="Excluir conta do cliente"><X size={14}/></button>
              </div>
            ))}
          </div>

          {/* Redefinir senha — o super-admin nunca vê a senha original, só define uma nova */}
          {resetPasswordFor && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
              <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 w-full max-w-sm">
                <h3 className="text-white font-bold mb-3">Redefinir senha</h3>
                <input
                  type="password"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setResetPasswordFor(null);
                      setNewPassword('');
                    }}
                    className="px-3 py-2 rounded-lg text-stone-400 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleResetPassword(resetPasswordFor)}
                    disabled={!newPassword}
                    className="px-3 py-2 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold disabled:opacity-50"
                  >
                    Salvar nova senha
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Criar/editar usuário + permissões */}
          {editing && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4 py-8 overflow-y-auto">
              <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 w-full max-w-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold">{editing.id ? 'Editar usuário' : 'Novo usuário'}</h3>
                  <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Nome"
                      className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                    />
                    <input
                      value={editing.login}
                      onChange={(e) => setEditing({ ...editing, login: e.target.value })}
                      placeholder="Login"
                      disabled={Boolean(editing.id)}
                      className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm disabled:opacity-50"
                    />
                  </div>

                  {!editing.id && (
                    <input
                      type="password"
                      value={editing.password}
                      onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                      placeholder="Senha inicial"
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={editing.restaurantSlug}
                      onChange={(e) => setEditing({ ...editing, restaurantSlug: e.target.value })}
                      className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                    >
                      <option value="">Todos os restaurantes</option>
                      {restaurants.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                      placeholder="Cargo (ex: gerente, operador)"
                      className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-stone-400 text-[11px] font-bold uppercase tracking-wide">Permissões</p>
                    {/* Atalho pra não precisar marcar ~25 caixinhas uma por uma
                        (era fácil esquecer alguma — ex: "Excluir histórico" —
                        e a conta ficar sem conseguir fazer ações básicas sem
                        nenhum aviso claro do motivo). */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, permissions: Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) })}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300"
                      >
                        Marcar todas
                      </button>
                      <span className="text-stone-600">·</span>
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, permissions: {} })}
                        className="text-[11px] font-bold text-stone-400 hover:text-stone-300"
                      >
                        Desmarcar todas
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.id}>
                        <p className="text-stone-400 text-[11px] font-bold uppercase tracking-wide mb-1.5">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {group.permissions.map((p) => (
                            <label
                              key={p.key}
                              className="flex items-center gap-2 text-xs text-stone-200 bg-stone-800/60 rounded-lg px-2 py-1.5 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(editing.permissions[p.key])}
                                onChange={() => setEditing(togglePermission(editing, p.key))}
                                className="accent-amber-500"
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : (
                      <>
                        <Check size={14} /> Salvar
                      </>
                    )}
                  </button>
                  <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-stone-400 text-xs font-bold">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
