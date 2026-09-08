import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerRecord } from '../../types/restaurant';
import {
  Users,
  Search,
  Trash2,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  Heart,
  Plus,
  Edit2,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const AdminCustomers: React.FC = () => {
  const {
    customers,
    deleteCustomer,
    clearCustomersData,
    addCustomer,
    updateCustomerNotes,
    restaurants,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrdersAll = customers.reduce((sum, c) => sum + c.totalOrders, 0);

  const handleClearAllCadastros = () => {
    if (
      window.confirm(
        'ATENÇÃO: Deseja realmente excluir TODOS os cadastros de clientes? Os pedidos existentes NÃO serão apagados, apenas a base de contatos de clientes.'
      )
    ) {
      clearCustomersData();
      alert('Cadastros de clientes excluídos com sucesso.');
    }
  };

  const handleDeleteSingle = (id: string, name: string) => {
    if (window.confirm(`Deseja remover o cadastro do cliente "${name}"?`)) {
      deleteCustomer(id);
    }
  };

  const handleSaveNotes = (id: string) => {
    updateCustomerNotes(id, editingNotes);
    setSelectedCustomer(null);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      alert('Preencha o nome e telefone do cliente.');
      return;
    }

    addCustomer({
      name: newName.trim(),
      phone: newPhone.trim(),
      notes: newNotes.trim() || undefined,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: new Date().toISOString(),
    });

    setNewName('');
    setNewPhone('');
    setNewNotes('');
    setIsAddingNew(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Gestão de Cadastros de Clientes (CRM Multicardápio)
            </h2>
            <p className="text-xs text-slate-400">
              Controle individual de clientes, histórico de consumo e preferências dos 4 restaurantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cadastro</span>
          </button>

          <button
            onClick={handleClearAllCadastros}
            className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            title="Excluir apenas os cadastros de clientes, sem apagar os pedidos"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir Todos os Cadastros</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <span className="text-slate-400 text-[11px] block">Total de Clientes Cadastrados</span>
          <span className="text-2xl font-black text-white mt-1 block">{customers.length}</span>
          <p className="text-[10px] text-slate-500 mt-1">Registrados automaticamente nos pedidos</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <span className="text-slate-400 text-[11px] block">Total de Pedidos Realizados</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{totalOrdersAll}</span>
          <p className="text-[10px] text-slate-500 mt-1">
            Média de {(totalOrdersAll / (customers.length || 1)).toFixed(1)} pedidos por cliente
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <span className="text-slate-400 text-[11px] block">Volume Consumido por Clientes</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            R$ {totalSpentAll.toFixed(2)}
          </span>
          <p className="text-[10px] text-slate-500 mt-1">Ticket médio: R$ {(totalSpentAll / (totalOrdersAll || 1)).toFixed(2)}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cadastro por nome, telefone ou observação/alergia..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p>Nenhum cadastro de cliente encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Telefone</th>
                  <th className="py-3.5 px-4 text-center">Pedidos</th>
                  <th className="py-3.5 px-4 text-right">Total Gasto</th>
                  <th className="py-3.5 px-4">Cozinha Favorita</th>
                  <th className="py-3.5 px-4">Alergias / Observações</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCustomers.map((cust) => {
                  const favSlug = cust.favoriteRestaurantSlug || cust.preferredRestaurant;
                  const favRest = favSlug ? restaurants[favSlug] : null;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-black text-xs">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{cust.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{cust.phone}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-400">
                        {cust.totalOrders}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400">
                        R$ {cust.totalSpent.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {favRest ? (
                          <span className="inline-flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-800">
                            <span>{favRest.emoji}</span>
                            <span>{favRest.name.split(' ')[0]}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {cust.notes ? (
                          <span className="bg-rose-950/40 text-rose-300 border border-rose-800/40 px-2 py-0.5 rounded text-[11px] line-clamp-1">
                            {cust.notes}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Nenhuma restrição</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setEditingNotes(cust.notes || '');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="Editar observações / alergias"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(cust.id, cust.name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300"
                            title="Excluir este cadastro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Notes Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Observações & Alergias: {selectedCustomer.name}
              </h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={3}
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Ex: Alérgico a camarão, prefere pouco sal, mora no ap 42..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveNotes(selectedCustomer.id)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Cadastrar Novo Cliente</h3>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Roberto Carlos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Observações / Restrições (Opcional)</label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: Intolerante a glúten"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Cadastrar Cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
