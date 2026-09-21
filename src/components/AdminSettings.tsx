import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug, OrderSoundType } from '../types/restaurant';
import { SOUND_PRESETS, playDelayAlertSound, triggerVibrate } from '../utils/audioAlert';
import { AdminFiscalModule } from './AdminFiscalModule';
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
  Volume2,
  VolumeX,
  Play,
  RotateCw,
  Bell,
  Check,
  AlertTriangle,
  Smartphone,
  Globe,
  Copy,
  FileText,
  Sliders,
} from 'lucide-react';

interface AdminSettingsProps {
  currentRestaurantSlug: RestaurantSlug;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  currentRestaurantSlug,
}) => {
  const {
    restaurants,
    updateRestaurantConfig,
    printerSettings,
    updatePrinterSettings,
    soundSettings,
    updateSoundSettings,
    delaySettings,
    updateDelaySettings,
    testSound,
    isAudioUnlocked,
    unlockAudioContext,
  } = useStore();
  const restaurant = restaurants[currentRestaurantSlug] || restaurants.japones;

  const [isOpen, setIsOpen] = useState(restaurant.isOpen);
  const [customUrlPath, setCustomUrlPath] = useState(restaurant.customUrlPath || restaurant.slug);
  const [copiedUrl, setCopiedUrl] = useState(false);
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

  // Sound Settings local state
  const [soundEnabled, setSoundEnabled] = useState(soundSettings.enabled);
  const [selectedSoundType, setSelectedSoundType] = useState<OrderSoundType>(soundSettings.soundType);
  const [soundVolume, setSoundVolume] = useState(soundSettings.volume);
  const [repeatSound, setRepeatSound] = useState(soundSettings.repeatUntilAcknowledged);
  const [vibrationEnabled, setVibrationEnabled] = useState(soundSettings.vibrationEnabled ?? true);
  const [alertOnPanel, setAlertOnPanel] = useState(soundSettings.alertOnPanel ?? true);
  const [alertOnMobile, setAlertOnMobile] = useState(soundSettings.alertOnMobile ?? true);

  // Delay Alert Settings local state
  const [delayAlertEnabled, setDelayAlertEnabled] = useState(delaySettings.enabled);
  const [delayThresholdMinutes, setDelayThresholdMinutes] = useState(delaySettings.thresholdMinutes || 15);
  const [delayRepeatInterval, setDelayRepeatInterval] = useState(delaySettings.repeatIntervalMinutes || 3);

  // Printer Settings local state
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(printerSettings?.paperWidth || '80mm');
  const [autoPrint, setAutoPrint] = useState(printerSettings?.autoPrintOnNewOrder ?? false);
  const [enableSmartAi, setEnableSmartAi] = useState(printerSettings?.enableSmartTicketAI ?? true);
  const [defaultPrinterName, setDefaultPrinterName] = useState(printerSettings?.defaultPrinterName || 'Impressora Cozinha ESC/POS');

  // Sub-aba: Geral vs Fiscal (ADMIN -> CONFIGURAÇÕES -> FISCAL)
  const [settingsTab, setSettingsTab] = useState<'geral' | 'fiscal'>('geral');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    updateRestaurantConfig(currentRestaurantSlug, {
      customUrlPath: customUrlPath.trim() || restaurant.slug,
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

    updateSoundSettings({
      enabled: soundEnabled,
      soundType: selectedSoundType,
      volume: soundVolume,
      repeatUntilAcknowledged: repeatSound,
      vibrationEnabled,
      alertOnPanel,
      alertOnMobile,
      alertOnDelay: delayAlertEnabled,
    });

    updateDelaySettings({
      enabled: delayAlertEnabled,
      thresholdMinutes: delayThresholdMinutes,
      repeatIntervalMinutes: delayRepeatInterval,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Selector: Geral vs Fiscal (ADMIN -> CONFIGURAÇÕES -> FISCAL) */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => setSettingsTab('geral')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            settingsTab === 'geral'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configurações Gerais &amp; Loja</span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsTab('fiscal')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            settingsTab === 'fiscal'
              ? 'bg-emerald-600 text-white font-black shadow-lg'
              : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Configurações Fiscais (NFC-e / NF-e / SEFAZ)</span>
          <span className="bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
            NOVO
          </span>
        </button>
      </div>

      {settingsTab === 'fiscal' ? (
        <AdminFiscalModule selectedSlug={currentRestaurantSlug} />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
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
        {/* Link HTTP Próprio & Rota Direta */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between text-amber-400 font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Link HTTP Próprio / Endereço Dedicado desta Loja</span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal lowercase font-mono">
              {window.location.origin}/{customUrlPath}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1">
                Slug / Rota Exclusiva (ex: SakuraSushiHouse, CantinaBellaVista)
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 focus-within:border-amber-500 rounded-xl px-3 py-2 text-white font-mono">
                <span className="text-slate-500 text-xs">{window.location.origin}/</span>
                <input
                  type="text"
                  value={customUrlPath}
                  onChange={(e) => setCustomUrlPath(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  className="bg-transparent text-amber-300 font-bold focus:outline-none flex-1 ml-0.5"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/${customUrlPath}`);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2500);
              }}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>Copiar Link HTTP</span>
                </>
              )}
            </button>
          </div>
        </div>

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

        {/* Sound Alert Configuration Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Sistema de Alerta Sonoro de Novos Pedidos
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                    Web Audio Hi-Fi
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Toca alerta sonoro instantâneo quando um cliente finaliza um pedido na vitrine ou balcão
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isAudioUnlocked && (
                <button
                  type="button"
                  onClick={unlockAudioContext}
                  className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Liberar Áudio do Navegador</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold text-xs transition-all ${
                  soundEnabled
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>Alertas Ativos</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-500" />
                    <span>Mudo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 5 Sound Options Selector */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">
              Escolha entre 5 Opções de Som para Novos Pedidos:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SOUND_PRESETS.map((preset) => {
                const isSelected = selectedSoundType === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedSoundType(preset.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/70 shadow-md shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{preset.emoji}</span>
                        <p className="font-bold text-xs text-white truncate">{preset.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{preset.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSoundType(preset.id);
                        testSound(preset.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1 shrink-0 transition-colors"
                      title="Ouvir amostra deste som"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Testar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume Control & Repetition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Volume do Alerta: {Math.round(soundVolume * 100)}%</span>
                </label>
                <button
                  type="button"
                  onClick={() => testSound(selectedSoundType)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  Testar volume atual
                </button>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>10% (Baixo)</span>
                <span>50% (Médio)</span>
                <span>100% (Máximo Cozinha)</span>
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-2">
              <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <input
                  type="checkbox"
                  checked={repeatSound}
                  onChange={(e) => setRepeatSound(e.target.checked)}
                  className="accent-amber-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    Repetição Contínua (Não Perder Pedido)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Toca o alerta sonoro a cada 25 segundos enquanto houver pedido com status <strong>RECEBIDO</strong> pendente de confirmação pela equipe.
                  </p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={(e) => setVibrationEnabled(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span className="text-slate-300 text-[11px]">Vibração Habilitada</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertOnMobile}
                    onChange={(e) => setAlertOnMobile(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span className="text-slate-300 text-[11px]">Alerta no Celular</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Alerta de Atraso e Tempo Limite de Produção */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Alarme Sonoro &amp; Vibração para Pedidos Atrasados</span>
            </div>
            <button
              type="button"
              onClick={() => setDelayAlertEnabled(!delayAlertEnabled)}
              className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all ${
                delayAlertEnabled
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {delayAlertEnabled ? 'Alarme de Atraso Ativo' : 'Desativado'}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Dispara um alarme sonoro com frequência urgente alternada e vibração no painel e nos celulares pareados quando qualquer pedido ultrapassar o tempo limite de espera sem ter saído da cozinha.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Tempo Limite para Considerar Atraso
              </label>
              <select
                value={delayThresholdMinutes}
                onChange={(e) => setDelayThresholdMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value={10}>10 minutos de espera</option>
                <option value={15}>15 minutos de espera (Recomendado)</option>
                <option value={20}>20 minutos de espera</option>
                <option value={30}>30 minutos de espera</option>
                <option value={45}>45 minutos de espera</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Repetição do Alarme de Atraso
              </label>
              <select
                value={delayRepeatInterval}
                onChange={(e) => setDelayRepeatInterval(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
              >
                <option value={1}>A cada 1 minuto</option>
                <option value={2}>A cada 2 minutos</option>
                <option value={3}>A cada 3 minutos (Padrão)</option>
                <option value={5}>A cada 5 minutos</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => {
                  unlockAudioContext();
                  playDelayAlertSound(soundVolume);
                  if (vibrationEnabled) triggerVibrate([300, 100, 300, 100, 400]);
                }}
                className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Testar Som de Atraso</span>
              </button>
            </div>
          </div>
        </div>

        {/* Impressora Térmica Inteligente & IA Copilot */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 md:col-span-2">
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
      )}
    </div>
  );
};
