import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { SalesChannelConfig, OrderType, PaymentMethod, ProductionStation } from '../types/restaurant';
import {
  SlidersHorizontal,
  CheckCircle2,
  Utensils,
  Store,
  Bike,
  Globe,
  QrCode,
  Printer,
  Clock,
  DollarSign,
  Palette,
  ChefHat,
  Save,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const AdminSalesChannelsSettings: React.FC = () => {
  const { salesChannels, updateSalesChannel, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<string>('mesa');

  const channelList = Object.values(salesChannels);
  const currentChannel = salesChannels[activeTab] || channelList[0];

  // Local state for editing current channel
  const [name, setName] = useState(currentChannel?.name || '');
  const [enabled, setEnabled] = useState(currentChannel?.enabled ?? true);
  const [color, setColor] = useState(currentChannel?.color || '#3B82F6');
  const [allowQrCode, setAllowQrCode] = useState(currentChannel?.allowQrCodeCustomerOrder ?? false);
  const [autoPrint, setAutoPrint] = useState(currentChannel?.autoPrintReceipt ?? true);
  const [operationalHours, setOperationalHours] = useState(currentChannel?.operationalHours || '11:00 às 23:00');
  const [stations, setStations] = useState<ProductionStation[]>(currentChannel?.productionStations || ['cozinha']);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    currentChannel?.acceptedPaymentMethods || ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro']
  );
  const [minOrderValue, setMinOrderValue] = useState<string>(
    currentChannel?.minOrderValue ? String(currentChannel.minOrderValue) : ''
  );
  const [description, setDescription] = useState(currentChannel?.description || '');

  // Synchronize when switching tabs
  const handleSelectTab = (channelId: string) => {
    const ch = salesChannels[channelId];
    if (ch) {
      setActiveTab(channelId);
      setName(ch.name);
      setEnabled(ch.enabled);
      setColor(ch.color);
      setAllowQrCode(ch.allowQrCodeCustomerOrder ?? false);
      setAutoPrint(ch.autoPrintReceipt ?? true);
      setOperationalHours(ch.operationalHours || '11:00 às 23:00');
      setStations(ch.productionStations || ['cozinha']);
      setPaymentMethods(ch.acceptedPaymentMethods || ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro']);
      setMinOrderValue(ch.minOrderValue ? String(ch.minOrderValue) : '');
      setDescription(ch.description || '');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChannel) return;

    updateSalesChannel(currentChannel.id, {
      name: name.trim() || currentChannel.name,
      enabled,
      color,
      allowQrCodeCustomerOrder: allowQrCode,
      autoPrintReceipt: autoPrint,
      operationalHours: operationalHours.trim(),
      productionStations: stations,
      acceptedPaymentMethods: paymentMethods,
      minOrderValue: minOrderValue ? parseFloat(minOrderValue) || 0 : undefined,
      description: description.trim(),
    });
  };

  const toggleStation = (station: ProductionStation) => {
    if (stations.includes(station)) {
      if (stations.length === 1) {
        showToast('O canal precisa ter ao menos uma praça de produção ativa.', 'warning');
        return;
      }
      setStations(stations.filter((s) => s !== station));
    } else {
      setStations([...stations, station]);
    }
  };

  const togglePaymentMethod = (pm: PaymentMethod) => {
    if (paymentMethods.includes(pm)) {
      if (paymentMethods.length === 1) {
        showToast('Selecione pelo menos uma forma de pagamento.', 'warning');
        return;
      }
      setPaymentMethods(paymentMethods.filter((p) => p !== pm));
    } else {
      setPaymentMethods([...paymentMethods, pm]);
    }
  };

  const getChannelIcon = (type: OrderType) => {
    switch (type) {
      case 'mesa':
        return <Utensils className="w-4 h-4" />;
      case 'balcao':
        return <Store className="w-4 h-4" />;
      case 'delivery':
        return <Bike className="w-4 h-4" />;
      case 'online':
        return <Globe className="w-4 h-4" />;
      case 'retirada':
        return <Store className="w-4 h-4" />;
      default:
        return <SlidersHorizontal className="w-4 h-4" />;
    }
  };

  const colorPresets = [
    { label: 'Azul Ciano (Balcão)', hex: '#0284C7' },
    { label: 'Âmbar Dourado (Mesa)', hex: '#D97706' },
    { label: 'Verde Esmeralda (Delivery)', hex: '#059669' },
    { label: 'Roxo Violeta (Online)', hex: '#7C3AED' },
    { label: 'Azul Real (Retirada)', hex: '#2563EB' },
    { label: 'Rosa Pink', hex: '#DB2777' },
    { label: 'Laranja Fogo', hex: '#EA580C' },
    { label: 'Cinza Ardósia', hex: '#475569' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0E1526] to-indigo-950/40 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 text-xs font-black uppercase tracking-wider">
              CONFIGURAÇÃO DE CANAIS
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Canais de Venda Independentes
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Configure identidade visual, regras de impressão, praças de produção e disponibilidade para cada canal de atendimento do restaurante.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Estrutura unificada de Pedido (ORDER)</span>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
        {channelList.map((ch) => {
          const isActive = ch.id === activeTab;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelectTab(ch.id)}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-slate-800 text-white shadow-lg border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ch.color }}
              />
              <span className="truncate">{ch.name.split(' ')[0]}</span>
              {!ch.enabled && (
                <span className="text-[10px] px-1 bg-rose-500/20 text-rose-300 rounded">Off</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Channel Editor Form */}
      {currentChannel && (
        <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                style={{ backgroundColor: color }}
              >
                {getChannelIcon(currentChannel.orderType)}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{currentChannel.name}</h3>
                <p className="text-xs text-slate-400">Tipo de Pedido: <strong className="font-mono text-indigo-400 uppercase">{currentChannel.orderType}</strong></p>
              </div>
            </div>

            {/* Ativar / Desativar Switch */}
            <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800">
              <span className="text-xs font-bold text-slate-300">Status do Canal:</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-black uppercase ${enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                {enabled ? 'Ativo' : 'Desativado'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Basic Info & Visual Identity */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-indigo-400" />
                Identidade Visual & Informações
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome de Exibição do Canal
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Cor do Canal (Identificação Visual Rápida)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-slate-950 border border-slate-800"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-32 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white"
                  />
                </div>

                {/* Color Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {colorPresets.map((cp) => (
                    <button
                      key={cp.hex}
                      type="button"
                      onClick={() => setColor(cp.hex)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] text-slate-300 transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cp.hex }} />
                      <span>{cp.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Horário de Operação
                </label>
                <input
                  type="text"
                  value={operationalHours}
                  onChange={(e) => setOperationalHours(e.target.value)}
                  placeholder="Ex: 11:00 às 23:30"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descrição / Orientações do Canal
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Instruções para a equipe de atendimento..."
                />
              </div>
            </div>

            {/* Right Column: Rules, Stations & Payment */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-orange-400" />
                Praças de Produção & Regras
              </h4>

              {/* Production Stations */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Praças de Produção (Onde os itens deste canal serão impressos/preparados)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cozinha', 'sushibar', 'bar'] as ProductionStation[]).map((station) => {
                    const isSelected = stations.includes(station);
                    return (
                      <button
                        key={station}
                        type="button"
                        onClick={() => toggleStation(station)}
                        className={`p-3 rounded-2xl border text-center font-bold text-xs uppercase flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <ChefHat className="w-4 h-4" />
                        <span>{station}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Print & QR Code Toggles */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Printer className="w-4 h-4 text-sky-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Impressão Automática de Comanda</p>
                      <p className="text-[11px] text-slate-400">Gera ticket de produção imediatamente ao entrar</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Pedido do Cliente por QR Code</p>
                      <p className="text-[11px] text-slate-400">Permite ao cliente lançar direto pelo celular na mesa</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowQrCode}
                    onChange={(e) => setAllowQrCode(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>

              {/* Payment Methods */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Formas de Pagamento Aceitas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pix', label: 'PIX Instantâneo' },
                    { id: 'cartao_credito', label: 'Cartão de Crédito' },
                    { id: 'cartao_debito', label: 'Cartão de Débito' },
                    { id: 'dinheiro', label: 'Dinheiro (Espécie)' },
                  ].map((pm) => {
                    const isSelected = paymentMethods.includes(pm.id as PaymentMethod);
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => togglePaymentMethod(pm.id as PaymentMethod)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold text-left flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span>{pm.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => handleSelectTab(activeTab)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Descartar</span>
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações do Canal</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
