import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderSoundType } from '../types/restaurant';
import { SOUND_PRESETS, playAlertSound, playDelayAlertSound, triggerVibrate, unlockAudio } from '../utils/audioAlert';
import {
  Smartphone,
  Volume2,
  VolumeX,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Radio,
  ArrowLeft,
  Sun,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';

interface MobileAlertReceiverProps {
  onBack?: () => void;
}

export const MobileAlertReceiver: React.FC<MobileAlertReceiverProps> = ({ onBack }) => {
  const { orders, soundSettings, delaySettings, silenceOrderDelay } = useStore();

  const [isPaired, setIsPaired] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('tokio_mobile_paired_id'));
  });
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('tokio_mobile_device_name') || 'Celular Cozinha';
  });
  const [deviceId, setDeviceId] = useState<string>(() => {
    return localStorage.getItem('tokio_mobile_paired_id') || '';
  });
  const [deviceVolume, setDeviceVolume] = useState<number>(() => {
    const saved = localStorage.getItem('tokio_mobile_volume');
    return saved ? parseFloat(saved) : 0.9;
  });
  const [deviceSound, setDeviceSound] = useState<OrderSoundType>(() => {
    const saved = localStorage.getItem('tokio_mobile_sound') as OrderSoundType;
    return saved || 'sound3';
  });
  const [vibrationActive, setVibrationActive] = useState(true);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [lastAlertMessage, setLastAlertMessage] = useState<string | null>(null);
  const [lastAlertTime, setLastAlertTime] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<any>(null);

  // Keep-alive heartbeat ping to backend (optimized to 35s to preserve server bandwidth)
  useEffect(() => {
    if (!deviceId) return;
    const sendPing = () => {
      fetch('/api/devices/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idOrCode: deviceId }),
      }).catch(() => {});
    };

    sendPing();
    const interval = setInterval(sendPing, 35000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // Screen Wake Lock API to prevent phone screen from turning off
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setIsWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    }
  };

  useEffect(() => {
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch {}
      }
    };
  }, []);

  // Unlock Audio
  const handleUnlockAudio = () => {
    const ok = unlockAudio();
    setAudioUnlocked(ok);
    requestWakeLock();
    playAlertSound(deviceSound, deviceVolume);
    if (vibrationActive) triggerVibrate([200, 100, 200]);
  };

  // Listen for NEW orders in real-time
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    // Check newly arrived orders
    orders.forEach((order) => {
      if (!seenOrderIdsRef.current.has(order.id)) {
        seenOrderIdsRef.current.add(order.id);

        // If order was created in last 2 minutes and is received
        const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
        if (orderAgeMs < 120000 && order.status === 'recebido') {
          triggerMobileAlert(
            `NOVO PEDIDO ${order.shortCode}!`,
            `${order.restaurantName} • ${order.items.length} itens • Total R$ ${order.total.toFixed(2)}`
          );
        }
      }
    });
  }, [orders, deviceSound, deviceVolume, vibrationActive]);

  // Delayed orders check
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const thresholdMs = (delaySettings.thresholdMinutes || 15) * 60 * 1000;

      const delayed = orders.filter((o) => {
        if (o.status !== 'recebido' && o.status !== 'em_preparo') return false;
        if (delaySettings.silencedOrderIds.includes(o.id)) return false;
        return (now - new Date(o.createdAt).getTime()) >= thresholdMs;
      });

      if (delayed.length > 0) {
        const first = delayed[0];
        const minutes = Math.floor((now - new Date(first.createdAt).getTime()) / 60000);
        triggerDelayMobileAlert(
          `ATENÇÃO: PEDIDO ATRASADO ${first.shortCode}!`,
          `Aguardando há ${minutes} min na cozinha • ${first.customerName}`
        );
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [orders, delaySettings, deviceVolume, vibrationActive]);

  const triggerMobileAlert = (title: string, details: string) => {
    setLastAlertMessage(`${title} - ${details}`);
    setLastAlertTime(new Date().toLocaleTimeString('pt-BR'));
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 2500);

    playAlertSound(deviceSound, deviceVolume);
    if (vibrationActive) {
      triggerVibrate([400, 150, 400, 150, 600]);
    }
  };

  const triggerDelayMobileAlert = (title: string, details: string) => {
    setLastAlertMessage(`${title} - ${details}`);
    setLastAlertTime(new Date().toLocaleTimeString('pt-BR'));
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 3000);

    playDelayAlertSound(deviceVolume);
    if (vibrationActive) {
      triggerVibrate([500, 150, 500, 150, 800]);
    }
  };

  // Pair device with code
  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = pairingCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    setIsPairingLoading(true);
    setPairError(null);

    try {
      const res = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: cleanCode,
          deviceName: deviceName.trim() || 'Celular Cozinha',
          platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'android',
          soundType: deviceSound,
          volume: deviceVolume,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPairError(data.error || 'Código de pareamento inválido ou expirado.');
        setIsPairingLoading(false);
        return;
      }

      const dev = data.device;
      setDeviceId(dev.id);
      setIsPaired(true);
      localStorage.setItem('tokio_mobile_paired_id', dev.id);
      localStorage.setItem('tokio_mobile_device_name', deviceName);
      localStorage.setItem('tokio_mobile_volume', deviceVolume.toString());
      localStorage.setItem('tokio_mobile_sound', deviceSound);
      setIsPairingLoading(false);
      handleUnlockAudio();
    } catch (err) {
      setPairError('Falha ao conectar ao servidor. Verifique sua rede Wi-Fi/4G.');
      setIsPairingLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Deseja desvincular este celular como receptor de alertas?')) {
      if (deviceId) {
        fetch(`/api/devices/${deviceId}`, { method: 'DELETE' }).catch(() => {});
      }
      setIsPaired(false);
      setDeviceId('');
      localStorage.removeItem('tokio_mobile_paired_id');
    }
  };

  // Delayed orders list
  const now = Date.now();
  const thresholdMs = (delaySettings.thresholdMinutes || 15) * 60 * 1000;
  const delayedOrders = orders.filter((o) => {
    if (o.status !== 'recebido' && o.status !== 'em_preparo') return false;
    return (now - new Date(o.createdAt).getTime()) >= thresholdMs;
  });

  const pendingOrders = orders.filter((o) => o.status === 'recebido');

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isFlashing
          ? 'bg-rose-600 text-white'
          : 'bg-slate-950 text-slate-100'
      } flex flex-col`}
    >
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Voltar ao Painel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Tokio inBox • Receptor Móvel</span>
                {isPaired && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                )}
              </h1>
              <p className="text-[11px] text-slate-400">
                {deviceName} • {isPaired ? 'Autorizado & Ativo' : 'Não pareado'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWakeLockActive ? (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
              <Sun className="w-3 h-3 text-emerald-400" />
              <span>Tela Sempre Ativa</span>
            </span>
          ) : (
            <button
              onClick={requestWakeLock}
              className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700"
            >
              Ativar WakeLock
            </button>
          )}

          {isPaired && (
            <button
              onClick={handleDisconnect}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg"
            >
              Desconectar
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Pairing Screen if not paired */}
        {!isPaired ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center my-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white">Conectar Celular ao Restaurante</h2>
              <p className="text-xs text-slate-400 mt-1">
                Insira o código de 6 dígitos gerado na aba "Dispositivos &amp; Celulares" do painel principal para autorizar este smartphone.
              </p>
            </div>

            <form onSubmit={handlePairDevice} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nome deste Aparelho
                </label>
                <input
                  type="text"
                  required
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Ex: Celular Cozinha 1, MotoG Balcão"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Código de Pareamento (6 dígitos)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pairingCodeInput}
                  onChange={(e) => {
                    setPairingCodeInput(e.target.value.toUpperCase());
                    setPairError(null);
                  }}
                  placeholder="Ex: 849201"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-amber-400 font-black placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {pairError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{pairError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isPairingLoading || pairingCodeInput.length < 6}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isPairingLoading ? (
                  <span>Conectando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Autorizar e Conectar Celular</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Active Receiver Dashboard */
          <>
            {/* Audio Permission Alert Banner if not unlocked */}
            {!audioUnlocked && (
              <div className="bg-amber-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-6 h-6 text-amber-400 animate-bounce shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-amber-200">
                      Toque para Ativar Áudio no Celular
                    </h3>
                    <p className="text-[11px] text-amber-300/80">
                      O navegador do celular bloqueia sons automáticos sem um primeiro toque.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUnlockAudio}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow shrink-0"
                >
                  Liberar Som
                </button>
              </div>
            )}

            {/* Quick Status Radar Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>RECEPTOR ATIVO EM TEMPO REAL</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                  Ping a cada 12s
                </span>
              </div>

              {/* Big Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Novos Pedidos
                  </span>
                  <p className="text-2xl font-black text-amber-400 mt-0.5">
                    {pendingOrders.length}
                  </p>
                  <span className="text-[10px] text-slate-500">Aguardando Cozinha</span>
                </div>

                <div
                  className={`border rounded-2xl p-3 text-center ${
                    delayedOrders.length > 0
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">
                    Em Atraso (&gt;{delaySettings.thresholdMinutes}m)
                  </span>
                  <p
                    className={`text-2xl font-black mt-0.5 ${
                      delayedOrders.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                    }`}
                  >
                    {delayedOrders.length}
                  </p>
                  <span className="text-[10px]">
                    {delayedOrders.length > 0 ? 'ALERTA URGENTE' : 'Tudo no prazo'}
                  </span>
                </div>
              </div>

              {/* Last Alert Log Display */}
              {lastAlertMessage && (
                <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-2xl">
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold">
                    <span>Último Alerta Disparado</span>
                    <span className="font-mono text-slate-400">{lastAlertTime}</span>
                  </div>
                  <p className="text-xs text-white mt-1 font-medium">{lastAlertMessage}</p>
                </div>
              )}
            </div>

            {/* Sound & Alert Controls on Phone */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Preferências de Alerta deste Celular</span>
              </h3>

              {/* Sound Presets */}
              <div>
                <label className="block text-[11px] text-slate-400 font-bold mb-2">
                  Toque Selecionado para este Celular:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {SOUND_PRESETS.map((p) => {
                    const active = deviceSound === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setDeviceSound(p.id);
                          localStorage.setItem('tokio_mobile_sound', p.id);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          active
                            ? 'bg-amber-500/15 border-amber-500/70 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p.emoji}</span>
                          <div>
                            <p className="text-xs font-bold">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{p.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeviceSound(p.id);
                            unlockAudio();
                            playAlertSound(p.id, deviceVolume);
                            if (vibrationActive) triggerVibrate([200, 100, 200]);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[11px] font-bold border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Testar</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-1">
                  <span>Volume no Alto-falante: {Math.round(deviceVolume * 100)}%</span>
                  <button
                    onClick={() => {
                      unlockAudio();
                      playAlertSound(deviceSound, deviceVolume);
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Testar Volume
                  </button>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={deviceVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setDeviceVolume(val);
                    localStorage.setItem('tokio_mobile_volume', val.toString());
                  }}
                  className="w-full accent-amber-500 bg-slate-950 h-2 rounded-lg cursor-pointer"
                />
              </div>

              {/* Vibration Toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-white block">Vibração em Alertas</span>
                  <span className="text-[11px] text-slate-400">
                    Faz o aparelho vibrar continuamente em novos pedidos e atrasos
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={vibrationActive}
                  onChange={(e) => setVibrationActive(e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>

              {/* Test Delay Alarm Button */}
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  triggerDelayMobileAlert(
                    'TESTE: ALARME DE ATRASO',
                    'Alarme com frequência especial para pedidos atrasados'
                  );
                }}
                className="w-full py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center justify-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Testar Alarme Sonoro de Pedido Atrasado</span>
              </button>
            </div>

            {/* List of Delayed Orders with Silence Option */}
            {delayedOrders.length > 0 && (
              <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-5 space-y-3 shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Pedidos que Excederam o Prazo</span>
                </h3>

                <div className="space-y-2">
                  {delayedOrders.map((ord) => {
                    const mins = Math.floor((now - new Date(ord.createdAt).getTime()) / 60000);
                    const isSilenced = delaySettings.silencedOrderIds.includes(ord.id);
                    return (
                      <div
                        key={ord.id}
                        className="p-3 bg-slate-950 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{ord.shortCode}</span>
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                              {mins} min
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{ord.customerName} • {ord.restaurantName}</p>
                        </div>

                        {!isSilenced ? (
                          <button
                            onClick={() => silenceOrderDelay(ord.id)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
                          >
                            Silenciar
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium italic">
                            Silenciado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
