import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantSlug } from '../../types/restaurant';
import {
  Save,
  CheckCircle2,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Bike,
  QrCode,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Printer,
  Bot,
} from 'lucide-react';

interface AdminSettingsProps {
  currentRestaurantSlug: RestaurantSlug;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  currentRestaurantSlug,
}) => {
  const { restaurants, updateRestaurantConfig, printerSettings, updatePrinterSettings } = useStore();
  const restaurant = restaurants[currentRestaurantSlug] || restaurants.japones;

  const [isOpen, setIsOpen] = useState(restaurant.isOpen);
  const [phone, setPhone] = useState(restaurant.phone);
  const [whatsapp, setWhatsapp] = useState(restaurant.whatsapp);
  const [address, setAddress] = useState(restaurant.address);
  const [openingHours, setOpeningHours] = useState(restaurant.openingHours);
  const [deliveryFee, setDeliveryFee] = useState(restaurant.deliveryFee.toString());
  const [minOrderValue, setMinOrderValue] = useState(restaurant.minOrderValue.toString());
  const [timeMin, setTimeMin] = useState(restaurant.estimatedTimeMin.toString());
  const [timeMax, setTimeMax] = useState(restaurant.estimatedTimeMax.toString());
  const [pixKey, setPixKey] = useState(restaurant.pixKey);
  const [pixReceiver, setPixReceiver] = useState(restaurant.pixReceiverName);
  const [splashEnabled, setSplashEnabled] = useState(restaurant.splashEnabled);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Printer Settings local state
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(printerSettings?.paperWidth || '80mm');
  const [autoPrint, setAutoPrint] = useState(printerSettings?.autoPrintOnNewOrder ?? false);
  const [enableSmartAi, setEnableSmartAi] = useState(printerSettings?.enableSmartTicketAI ?? true);
  const [defaultPrinterName, setDefaultPrinterName] = useState(printerSettings?.defaultPrinterName || 'Impressora Cozinha ESC/POS');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    updateRestaurantConfig(currentRestaurantSlug, {
      isOpen,
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      address: address.trim(),
      openingHours: openingHours.trim(),
      deliveryFee: parseFloat(deliveryFee) || 0,
      minOrderValue: parseFloat(minOrderValue) || 0,
      estimatedTimeMin: parseInt(timeMin, 10) || 30,
      estimatedTimeMax: parseInt(timeMax, 10) || 50,
      pixKey: pixKey.trim(),
      pixReceiverName: pixReceiver.trim(),
      splashEnabled,
    });

    updatePrinterSettings({
      paperWidth,
      autoPrintOnNewOrder: autoPrint,
      enableSmartTicketAI: enableSmartAi,
      defaultPrinterName: defaultPrinterName.trim() || 'Impressora Cozinha ESC/POS',
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner with Open/Closed switch */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{restaurant.emoji}</div>
          <div>
            <h2 className="text-base font-bold text-white">
              Configurações: {restaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Personalize regras operacionais, delivery, PIX e horários deste restaurante
            </p>
          </div>
        </div>

        {/* Status Aberto / Fechado Switch */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 font-bold text-xs transition-all shadow-md ${
            isOpen
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500 text-rose-300'
          }`}
        >
          {isOpen ? (
            <>
              <ToggleRight className="w-5 h-5 text-emerald-400" />
              <span>LOJA ABERTA (Recebendo Pedidos)</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-5 h-5 text-rose-400" />
              <span>LOJA FECHADA (Cardápio em Pausa)</span>
            </>
          )}
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Configurações salvas e aplicadas em tempo real com sucesso!</span>
        </div>
      )}

      {/* Grid Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Contato & WhatsApp */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <MessageCircle className="w-4 h-4" />
            <span>Contatos & Notificações</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1">
                WhatsApp para Recebimento de Pedidos (somente números com DDD)
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="5511987654321"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Telefone Fixo / Exibição</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Endereço Completo</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Paulista, 1200 - São Paulo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Horário de Funcionamento</label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Terça a Domingo das 18h às 23h30"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Prazos */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <Bike className="w-4 h-4" />
            <span>Valores & Tempo de Entrega</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Taxa de Entrega (R$)</label>
                <input
                  type="number"
                  step="0.10"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Pedido Mínimo (R$)</label>
                <input
                  type="number"
                  step="1.00"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Tempo Mínimo (minutos)</label>
                <input
                  type="number"
                  value={timeMin}
                  onChange={(e) => setTimeMin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tempo Máximo (minutos)</label>
                <input
                  type="number"
                  value={timeMax}
                  onChange={(e) => setTimeMax(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PIX Instantâneo */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <QrCode className="w-4 h-4" />
            <span>Dados de Recebimento PIX</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1">Chave PIX (E-mail, CNPJ ou Celular)</label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="sakura@tokioinbox.com.br"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Nome do Favorecido / Razão Social</label>
              <input
                type="text"
                value={pixReceiver}
                onChange={(e) => setPixReceiver(e.target.value)}
                placeholder="Sakura Sushi House Ltda"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Splash de Boas-vindas */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Splash Screen de Boas-Vindas</span>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={splashEnabled}
                onChange={(e) => setSplashEnabled(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <span className="font-semibold">
                Exibir tela de abertura com fotos e destaques do restaurante
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              A tela de abertura apresenta fotos em tela cheia do ambiente e pratos, estilo
              iFood/Uber Eats, com botão &quot;Pular&quot;.
            </p>
          </div>
        </div>

        {/* Impressora Térmica Inteligente & IA Copilot */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
              <Printer className="w-4 h-4" />
              <span>Impressora Térmica Inteligente &amp; IA Copilot</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
              ESC/POS 80mm / 58mm
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Ajuste os parâmetros para emissão automática de comandas de cozinha, com suporte à inteligência artificial para detecção de alergias e roteamento de praça de preparo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Largura Padrão da Bobina Térmica
              </label>
              <select
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value as '80mm' | '58mm')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value="80mm">80mm (Bobina Larga Padrão Restaurante / Cupom Fiscal)</option>
                <option value="58mm">58mm (Bobina Estreita / Mini Impressora Bluetooth)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Identificador da Impressora / Fila
              </label>
              <input
                type="text"
                value={defaultPrinterName}
                onChange={(e) => setDefaultPrinterName(e.target.value)}
                placeholder="Ex: Impressora Cozinha ESC/POS"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSmartAi}
                onChange={(e) => setEnableSmartAi(e.target.checked)}
                className="accent-amber-500 w-4 h-4 mt-0.5"
              />
              <div>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  Ativar Inteligência Artificial no Ticket Térmico (Recomendado)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gera resumo executivo do pedido, destaca avisos de alergia/intolerância alimentar e sugere sequência e praça de preparo prioritária diretamente na comanda.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="accent-amber-500 w-4 h-4 mt-0.5"
              />
              <div>
                <span className="font-bold text-white">
                  Auto-Imprimir ao Receber Novo Pedido
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Abre a caixa de diálogo de impressão térmica automaticamente assim que um novo pedido for confirmado no painel.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          type="submit"
          className="w-full py-3.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl hover:shadow-amber-500/20 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Alterações do Restaurante</span>
        </button>
      </div>
    </form>
  );
};
