import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { UserAccount, UserRole, UserPermissions } from '../types/restaurant';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Check,
  X,
  ChefHat,
  Bike,
  Receipt,
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const { currentUser, checkPermission, logAction, restaurants } = useStore();

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<UserAccount | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caixa');
  const [restaurantAccess, setRestaurantAccess] = useState<'all' | 'japones' | 'hamburgueria' | 'pizzaria' | 'brasileiro'>('all');
  const [permissions, setPermissions] = useState<UserPermissions>({
    can_view_orders: true,
    can_change_status: true,
    can_edit_menu: false,
    can_delete_orders: false,
    can_manage_users: false,
    can_configure_alerts: false,
    can_print_tickets: true,
  });

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = () => {
    const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchUsersList = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    // Apply role default permissions
    switch (newRole) {
      case 'super_admin':
      case 'administrador':
        setPermissions({
          can_view_orders: true,
          can_change_status: true,
          can_edit_menu: true,
          can_delete_orders: true,
          can_manage_users: newRole === 'super_admin',
          can_configure_alerts: true,
          can_print_tickets: true,
        });
        break;
      case 'caixa':
        setPermissions({
          can_view_orders: true,
          can_change_status: true,
          can_edit_menu: false,
          can_delete_orders: false,
          can_manage_users: false,
          can_configure_alerts: false,
          can_print_tickets: true,
        });
        break;
      case 'cozinha':
        setPermissions({
          can_view_orders: true,
          can_change_status: true,
          can_edit_menu: false,
          can_delete_orders: false,
          can_manage_users: false,
          can_configure_alerts: true,
          can_print_tickets: true,
        });
        break;
      case 'entrega':
        setPermissions({
          can_view_orders: true,
          can_change_status: true,
          can_edit_menu: false,
          can_delete_orders: false,
          can_manage_users: false,
          can_configure_alerts: false,
          can_print_tickets: false,
        });
        break;
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole('caixa');
    setRestaurantAccess('all');
    handleRoleChange('caixa');
    setEditUser(null);
    setShowAddModal(false);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditUser(user);
    setName(user.name);
    setUsername(user.username);
    setPassword(''); // leave blank unless updating
    setRole(user.role);
    setRestaurantAccess(user.restaurantAccess);
    setPermissions(user.permissions);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editUser) {
        // Update user
        const res = await fetch(`/api/users/${editUser.id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            username,
            role,
            password: password.trim() ? password.trim() : undefined,
            restaurantAccess,
            permissions,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatusMsg({ type: 'error', text: data.error || 'Erro ao atualizar usuário' });
          return;
        }
        setStatusMsg({ type: 'success', text: `Usuário ${name} atualizado com sucesso.` });
        logAction(`Atualizou dados e permissões do usuário @${username}`, 'user');
      } else {
        // Create user
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            username,
            password,
            role,
            restaurantAccess,
            permissions,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatusMsg({ type: 'error', text: data.error || 'Erro ao criar usuário' });
          return;
        }
        setStatusMsg({ type: 'success', text: `Usuário @${username} criado com sucesso.` });
        logAction(`Criou novo usuário @${username} com perfil ${role}`, 'user');
      }

      await fetchUsersList();
      resetForm();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        fetchUsersList();
        logAction(`${user.isActive ? 'Desativou' : 'Ativou'} acesso do usuário @${user.username}`, 'user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.role === 'super_admin') {
      alert('Não é permitido excluir a conta do Super Administrador.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja remover o usuário @${user.username}?`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Usuário @${user.username} excluído.` });
        logAction(`Excluiu o usuário @${user.username}`, 'user');
        fetchUsersList();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'super_admin':
        return (
          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
            Super Admin
          </span>
        );
      case 'administrador':
        return (
          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
            Gerente / Admin
          </span>
        );
      case 'caixa':
        return (
          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
            Caixa &amp; Balcão
          </span>
        );
      case 'cozinha':
        return (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
            Cozinha &amp; KDS
          </span>
        );
      case 'entrega':
        return (
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
            Entregador
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>Gestão de Usuários e Permissões</span>
              <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                {users.length} Contas
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle quem acessa o painel, pode alterar status de pedidos, editar cardápio ou gerenciar sons.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-lg"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Usuário</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Política de senhas */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-1">
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>Senhas dos colaboradores</span>
        </h4>
        <p className="text-[11px] text-slate-400">
          Cada colaborador deve ter usuário e senha próprios (mínimo 8 caracteres, sem senhas óbvias como
          "12345678" ou "senha123"). Ao trocar a senha ou desativar um usuário, as sessões abertas dele são encerradas.
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Usuários Cadastrados no Sistema</h3>
          <span className="text-xs text-slate-400">Segurança PBKDF2 com Salt criptográfico</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800">
                <th className="p-4">Nome / Usuário</th>
                <th className="p-4">Função (Perfil)</th>
                <th className="p-4">Acesso às Lojas</th>
                <th className="p-4">Permissões Principais</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white text-sm">{u.name}</div>
                    <div className="text-slate-400 text-[11px] font-mono">@{u.username}</div>
                  </td>
                  <td className="p-4">{getRoleBadge(u.role)}</td>
                  <td className="p-4 text-slate-300 capitalize">
                    {u.restaurantAccess === 'all' ? 'Todas as 4 lojas' : u.restaurantAccess}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {u.permissions?.can_change_status && (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          Mudar Status
                        </span>
                      )}
                      {u.permissions?.can_edit_menu && (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          Editar Cardápio
                        </span>
                      )}
                      {u.permissions?.can_delete_orders && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                          Excluir
                        </span>
                      )}
                      {u.permissions?.can_manage_users && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                          Admin Usuários
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                        u.isActive
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Editar usuário"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Adding / Editing User */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>{editUser ? 'Editar Usuário' : 'Novo Usuário do Sistema'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nome de Usuário (Login)</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Ex: carlos.caixa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {editUser ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha de Acesso'}
                </label>
                <input
                  type="password"
                  required={!editUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Perfil / Função</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500 outline-none"
                  >
                    <option value="caixa">Caixa &amp; Atendimento</option>
                    <option value="cozinha">Cozinha &amp; Produção</option>
                    <option value="sushi_bar">Sushibar</option>
                    <option value="bar">Bar &amp; Drinks</option>
                    <option value="garcom">Garçom &amp; Salão</option>
                    <option value="entrega">Entregador &amp; Expedição</option>
                    <option value="administrador">Gerente / Admin</option>
                    <option value="super_admin">Super Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Restaurante Permitido</label>
                  <select
                    value={restaurantAccess}
                    onChange={(e) => setRestaurantAccess(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 outline-none"
                  >
                    <option value="all">Todos os restaurantes</option>
                    {Object.values(restaurants).map((r: any) => (
                      <option key={r.slug} value={r.slug}>
                        Apenas {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold">Permissões Customizadas:</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_orders}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_view_orders: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>Visualizar Pedidos</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_change_status}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_change_status: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>Alterar Status</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_print_tickets}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_print_tickets: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>Imprimir Comandas</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_configure_alerts}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_configure_alerts: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>Configurar Sons</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_edit_menu}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_edit_menu: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span>Editar Cardápio</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_delete_orders}
                      onChange={(e) => setPermissions((p) => ({ ...p, can_delete_orders: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span className="text-rose-300">Excluir Pedidos</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg"
                >
                  {editUser ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
