import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ConnectedDevice } from '../types/restaurant';
import { SOUND_PRESETS, playAlertSound, playDelayAlertSound } from '../utils/audioAlert';
import {
  Smartphone,
  Radio,
  QrCode,
  Plus,
  Trash2,
  RefreshCw,
  Volume2,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Play,
  ShieldCheck,
  Bell,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface AdminDevicesProps {
  onOpenMobileReceiver?: () => void;
}

export const AdminDevices: React.FC<AdminDevicesProps> = ({ onOpenMobileReceiver }) => {
  const { connectedDevices, refreshDevices, logAction, testSound } = useStore();

  const [activePairingCode, setActivePairingCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  // Load a fresh pairing code on mount
  const handleGeneratePairingCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch('/api/devices/new-pairing-code');
      const data = await res.json();
      if (data.success && data.code) {
        setActivePairingCode(data.code);
      }
    } catch (e) {
      console.error('Error generating pairing code:', e);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  useEffect(() => {
    handleGeneratePairingCode();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshDevices();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja revogar o acesso do dispositivo "${name}"?`)) return;

    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await refreshDevices();
        setSuccessMsg(`Dispositivo "${name}" desconectado com sucesso.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error disconnecting device:', err);
    }
  };

  const handleTestDeviceAlert = (device: ConnectedDevice) => {
    setTestingDeviceId(device.id);
    playAlertSound(device.soundType, device.volume);
    logAction(`Testou som de alerta no receptor móvel "${device.deviceName}"`, 'device');
    setTimeout(() => setTestingDeviceId(null), 2000);
  };

  const onlineDevicesCount = connectedDevices.filter((d) => d.status === 'online').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>Dispositivos &amp; Celulares Conectados</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                {onlineDevicesCount} Online
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Conecte smartphones da cozinha, balcão ou gerência para receber toques e vibrações de pedidos em tempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {onOpenMobileReceiver && (
            <button
              onClick={onOpenMobileReceiver}
              className="flex-1 md:flex-initial px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 shadow"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Abrir Modo Receptor no Navegador</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Atualizar lista de dispositivos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Pairing Code Card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Código Ativo para Conectar Novo Celular</span>
            </div>
            <h3 className="text-xl font-black text-white">
              Como parear um celular como receptor sonoro:
            </h3>
            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
              <li>No celular da equipe, acesse este mesmo endereço do cardápio</li>
              <li>Toque no botão <strong>"Modo Receptor Móvel"</strong> ou abra a tela de pareamento</li>
              <li>Digite o código de 6 dígitos exibido abaixo e clique em confirmar</li>
            </ol>
          </div>

          <div className="bg-slate-950/90 border border-amber-500/50 rounded-2xl p-5 text-center shadow-inner min-w-[240px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Código de Pareamento
            </span>
            <div className="text-3xl font-mono font-black tracking-widest text-amber-400 select-all py-1">
              {activePairingCode || '------'}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Válido para novos aparelhos autorizados
            </p>

            <button
              onClick={handleGeneratePairingCode}
              disabled={isGeneratingCode}
              className="mt-3 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 rounded-lg border border-amber-500/30 w-full transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isGeneratingCode ? 'animate-spin' : ''}`} />
              <span>Gerar Novo Código</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connected Devices List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>Aparelhos Cadastrados ({connectedDevices.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            Monitoramento de status e nível de bateria/rede
          </span>
        </div>

        {connectedDevices.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
            <Smartphone className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">Nenhum celular conectado no momento</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Utilize o código de pareamento acima no celular de um cozinheiro ou gerente para autorizar o recebimento de alertas sonoros.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {connectedDevices.map((dev) => {
              const isOnline = dev.status === 'online';
              const preset = SOUND_PRESETS.find((p) => p.id === dev.soundType) || SOUND_PRESETS[0];

              return (
                <div
                  key={dev.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isOnline
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-850 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                          isOnline
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">{dev.deviceName}</h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              isOnline
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isOnline ? (
                              <>
                                <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                                <span>ONLINE</span>
                              </>
                            ) : (
                              <>
                                <WifiOff className="w-2.5 h-2.5 text-slate-500" />
                                <span>OFFLINE</span>
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {dev.platform.toUpperCase()} • Código: {dev.pairingCode}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDisconnect(dev.id, dev.deviceName)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Desconectar este aparelho"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Device Configuration Details */}
                  <div className="mt-3.5 pt-3 border-t border-slate-850 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span>{preset.emoji}</span>
                        <span className="text-slate-300 font-semibold">{preset.name}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Volume: {Math.round(dev.volume * 100)}% • Vibração: {dev.vibrationEnabled ? 'Sim' : 'Não'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleTestDeviceAlert(dev)}
                      disabled={testingDeviceId === dev.id}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{testingDeviceId === dev.id ? 'Tocando...' : 'Testar Som'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
