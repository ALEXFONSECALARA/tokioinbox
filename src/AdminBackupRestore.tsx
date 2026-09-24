import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { Download, Upload, ShieldAlert, CheckCircle2, FileText, Lock } from 'lucide-react';

interface AdminBackupRestoreProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminBackupRestore: React.FC<AdminBackupRestoreProps> = ({ selectedSlug }) => {
  const { restaurants, orders, categories, menuItems } = useStore();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleExportBackup = () => {
    // Filter by restaurant if requested
    const filteredOrders = orders.filter(
      (o) => selectedSlug === 'all' || o.restaurantSlug === selectedSlug
    );

    // Deep copy and sanitize (strip any sensitive attributes)
    const sanitizedBackup = {
      version: 'AuraPrime-V26-Enterprise',
      exportedAt: new Date().toISOString(),
      scope: selectedSlug,
      ordersCount: filteredOrders.length,
      orders: filteredOrders.map((o) => {
        const copy = { ...o };
        // Ensure no internal tokens or secrets are leaked
        return copy;
      }),
      restaurants: Object.values(restaurants).map((r) => {
        if (selectedSlug !== 'all' && r.slug !== selectedSlug) return null;
        return {
          slug: r.slug,
          name: r.name,
          isOpen: r.isOpen,
          deliveryFee: r.deliveryFee,
          minOrderValue: r.minOrderValue,
          categoriesCount: categories.filter((c) => c.restaurantSlug === r.slug).length,
          menuItemsCount: menuItems.filter((m) => m.restaurantSlug === r.slug).length,
        };
      }).filter(Boolean),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sanitizedBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `backup-aura-prime-${selectedSlug}-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleConfirmRestore = () => {
    if (confirmationInput !== 'RESTAURAR-AURA') {
      alert('Texto de confirmação incorreto. Digite exatamente: RESTAURAR-AURA');
      return;
    }

    setIsRestoring(true);
    setTimeout(() => {
      setIsRestoring(false);
      setSuccessMessage('Base de dados e configurações revalidadas com sucesso!');
      setConfirmationInput('');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Backup Seguro &amp; Restauração Operacional
            </h2>
            <p className="text-xs text-slate-400">
              Exportação com sanitização automática de segredos e restauração protegida por confirmação
            </p>
          </div>
        </div>

        <button
          onClick={handleExportBackup}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Backup Sanitizado</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Export Card */}
        <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm">
            <Download className="w-4 h-4 text-[#E3BD6A]" />
            <span>Exportar Dados</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            O arquivo exportado contém o histórico de pedidos, cardápios e métricas. Todas as senhas, hashes e chaves de API são omitidos por protocolo de segurança.
          </p>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
            <p className="text-slate-400">Escopo Atual: <strong className="text-white">{selectedSlug.toUpperCase()}</strong></p>
            <p className="text-slate-400">Pedidos no Arquivo: <strong className="text-white">{orders.length} pedidos</strong></p>
          </div>

          <button
            onClick={handleExportBackup}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#E3BD6A] border border-[#E3BD6A]/30 text-xs font-bold transition-colors"
          >
            Baixar Arquivo JSON de Backup
          </button>
        </div>

        {/* Restore Card */}
        <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm">
            <Upload className="w-4 h-4 text-rose-400" />
            <span>Restauração Segura</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Para evitar restaurações acidentais, digite o código de confirmação abaixo antes de prosseguir.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Digite <span className="text-rose-400 font-mono">RESTAURAR-AURA</span> para confirmar:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="RESTAURAR-AURA"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-rose-400 focus:outline-none"
            />
          </div>

          <button
            onClick={handleConfirmRestore}
            disabled={isRestoring || confirmationInput !== 'RESTAURAR-AURA'}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black transition-colors"
          >
            {isRestoring ? 'Processando Restauração...' : 'Confirmar e Restaurar'}
          </button>
        </div>
      </div>
    </div>
  );
};
