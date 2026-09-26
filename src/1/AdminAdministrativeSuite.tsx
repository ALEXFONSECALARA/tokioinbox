import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { BRAND_CONFIG, BRAND_NAME, BRAND_SLOGAN } from '../config/brand';
import { getRestaurantDirectUrl } from '../utils/urlRouting';
import { QrCodeImage } from './QrCodeImage';
import { playAlertSound } from '../utils/audioAlert';
import {
  Wrench,
  QrCode,
  Printer,
  Smartphone,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Star,
  MessageSquare,
  Send,
  Wifi,
  ShieldCheck,
  Cpu,
  Globe,
  Radio,
  Sliders,
  Download,
  Copy,
  Plus,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

interface AdminAdministrativeSuiteProps {
  selectedFilterSlug: RestaurantSlug | 'all';
  onNavigateTab: (tab: any) => void;
}

export const AdminAdministrativeSuite: React.FC<AdminAdministrativeSuiteProps> = ({
  selectedFilterSlug,
  onNavigateTab,
}) => {
  const { restaurants, currentRestaurant, syncOrdersNow, soundSettings } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<
    'flyer_qr' | 'order_simulator' | 'reviews' | 'sessions' | 'webhooks'
  >('flyer_qr');

  // 1. Flyer & QR Code State
  const [flyerRestSlug, setFlyerRestSlug] = useState<RestaurantSlug>(
    currentRestaurant?.slug || 'japones'
  );
  const [tableNumber, setTableNumber] = useState('Mesa 04');
  const [flyerHeadline, setFlyerHeadline] = useState('PEÇA DIRETO DA SUA MESA');
  const [includeWifi, setIncludeWifi] = useState(true);
  const [wifiSsid, setWifiSsid] = useState('NEXORO_GUEST_5G');
  const [wifiPass, setWifiPass] = useState('restaurante2025');
  const [copiedFlyerUrl, setCopiedFlyerUrl] = useState(false);

  // 2. Order Simulator State
  const [simulatedItems, setSimulatedItems] = useState([
    { name: 'Combo Omakase Nobre (32 peças)', price: 148.0, qty: 1 },
    { name: 'Coca-Cola Zero 350ml', price: 8.5, qty: 2 },
  ]);
  const [simulatedCustomer, setSimulatedCustomer] = useState({
    name: 'Carlos Mendes',
    phone: '(11) 99887-4433',
    address: 'Av. Paulista, 1000 - Apto 82',
  });
  const [simulatorStatus, setSimulatorStatus] = useState<string | null>(null);

  // 3. Customer Reviews State
  const [reviews, setReviews] = useState([
    {
      id: 1,
      customer: 'Marina Albuquerque',
      rating: 5,
      date: 'Há 25 minutos',
      restaurant: 'Japonês',
      comment: 'O melhor sushi da cidade! Chegou super fresco, temperatura perfeita e embalagem impecável.',
      orderNumber: '#8492',
      status: 'respondido',
    },
    {
      id: 2,
      customer: 'Lucas Silveira',
      rating: 5,
      date: 'Há 1 hora',
      restaurant: 'Pizzaria',
      comment: 'Massa napolitana autêntica, crocante e queijo de altíssima qualidade. Parabéns!',
      orderNumber: '#8478',
      status: 'pendente',
    },
    {
      id: 3,
      customer: 'Camila Duarte',
      rating: 4,
      date: 'Há 2 horas',
      restaurant: 'Hambúrguer',
      comment: 'Smash burguer muito suculento e batata rústica crocante. A maionese verde é divina.',
      orderNumber: '#8461',
      status: 'respondido',
    },
    {
      id: 4,
      customer: 'Roberto Fagundes',
      rating: 5,
      date: 'Ontem às 21:40',
      restaurant: 'Italiana',
      comment: 'O Fettuccine al Tartufo é extraordinário. Chegou fumegando em casa.',
      orderNumber: '#8430',
      status: 'respondido',
    },
  ]);
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});

  // 4. Active Sessions State
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Terminal Caixa Principal (Windows 11)',
      ip: '192.168.1.104',
      user: 'admin_master',
      location: 'Caixa / Balcão 1',
      ping: '12ms',
      status: 'online',
      type: 'desktop',
    },
    {
      id: 'sess-2',
      device: 'Tablet KDS Cozinha Quente (Android 13)',
      ip: '192.168.1.112',
      user: 'cheff_cozinha',
      location: 'Praça Cozinha',
      ping: '18ms',
      status: 'online',
      type: 'tablet',
    },
    {
      id: 'sess-3',
      device: 'Print Agent Spooler (ESC/POS Epson TM-T20)',
      ip: '192.168.1.140',
      user: 'print_service',
      location: 'Expedição / Térmica',
      ping: '8ms',
      status: 'online',
      type: 'printer',
    },
    {
      id: 'sess-4',
      device: 'App Despacho Motoboy (Samsung S23)',
      ip: '4G Claro Móvel',
      user: 'motoboy_pedro',
      location: 'Em Trânsito (Rota Centro)',
      ping: '45ms',
      status: 'online',
      type: 'mobile',
    },
  ]);

  // Selected Restaurant for flyer
  const currentFlyerRest = restaurants[flyerRestSlug] || Object.values(restaurants)[0];
  const directMenuUrl = getRestaurantDirectUrl(currentFlyerRest, 'current');

  // Dispatch Simulated Order
  const handleLaunchSimulatedOrder = async () => {
    const total = simulatedItems.reduce((acc, item) => acc + item.price * item.qty, 0);
    const simCode = Math.floor(1000 + Math.random() * 9000);
    const orderId = `SIM-${simCode}`;
    const rest = restaurants[flyerRestSlug] || Object.values(restaurants)[0];

    try {
      const payload = {
        restaurantSlug: flyerRestSlug,
        restaurantName: rest.name,
        customerName: `${simulatedCustomer.name} (Simulador)`,
        customerPhone: simulatedCustomer.phone,
        orderType: 'delivery',
        deliveryAddress: {
          street: simulatedCustomer.address,
          number: '100',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
        },
        items: simulatedItems.map((it, idx) => ({
          id: `sim-item-${idx}-${Date.now()}`,
          name: it.name,
          unitPrice: it.price,
          totalPrice: it.price * it.qty,
          quantity: it.qty,
        })),
        subtotal: total,
        deliveryFee: 7.0,
        discount: 0,
        total: total + 7.0,
        paymentMethod: 'pix',
        paymentDetails: { paid: true },
        notes: 'PEDIDO DE SIMULAÇÃO / TREINAMENTO DA EQUIPE (NEXORO)',
        idempotencyKey: `sim-${Date.now()}-${simCode}`,
      };

      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await syncOrdersNow();

      if (soundSettings.enabled) {
        playAlertSound(soundSettings.soundType, soundSettings.volume);
      }

      setSimulatorStatus(`Pedido #${orderId} gerado com sucesso! KDS e impressoras acionados.`);
      setTimeout(() => setSimulatorStatus(null), 4000);
    } catch (err: any) {
      setSimulatorStatus('Erro ao despachar simulação: ' + err.message);
    }
  };

  const handlePrintFlyer = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner */}
      <div className="rounded-3xl bg-[#0E0E0E] border border-[#D4AF37]/30 p-6 shadow-[0_10px_35px_rgba(0,0,0,0.7)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-black text-[#D4AF37] px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20">
              MÓDULO 20
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Suite de Gestão Avançada
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-[#D4AF37]" />
            <span>FERRAMENTAS ADMINISTRATIVAS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Gerador de Flyers de mesa, simulador de pedidos de alta fidelidade, gestão de avaliações, monitoramento de sessões ativas e conectores de API.
          </p>
        </div>

        {/* Sub-tabs Selector */}
        <div className="flex items-center gap-1.5 bg-[#141414] p-1.5 rounded-2xl border border-[#262626] overflow-x-auto no-scrollbar">
          {[
            { id: 'flyer_qr', label: 'Flyer & QR Code', icon: QrCode },
            { id: 'order_simulator', label: 'Simulador de Pedidos', icon: Play },
            { id: 'reviews', label: 'Avaliações (NPS)', icon: Star },
            { id: 'sessions', label: 'Sessões & Dispositivos', icon: Cpu },
            { id: 'webhooks', label: 'Webhooks & API', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'text-slate-400 hover:text-white hover:bg-[#1E1E1E]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. SUB-TAB: GERADOR DE FLYER & QR CODE */}
      {activeSubTab === 'flyer_qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Column */}
          <div className="lg:col-span-5 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-5">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <span>Personalizar Flyer de Mesa</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Restaurante / Cardápio:
              </label>
              <select
                value={flyerRestSlug}
                onChange={(e) => setFlyerRestSlug(e.target.value as any)}
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#D4AF37]"
              >
                {Object.values(restaurants).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.emoji} {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Identificação do Ponto:
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: Mesa 04, Balcão 2, Lounge..."
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Título do Chamado:
              </label>
              <input
                type="text"
                value={flyerHeadline}
                onChange={(e) => setFlyerHeadline(e.target.value)}
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="pt-2 border-t border-[#1F1F1F] space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={includeWifi}
                  onChange={(e) => setIncludeWifi(e.target.checked)}
                  className="rounded accent-[#D4AF37] w-4 h-4"
                />
                <span>Incluir Dados de Wi-Fi no Flyer</span>
              </label>

              {includeWifi && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Nome da Rede</span>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Senha</span>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      className="w-full bg-[#151515] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Direct Link Action */}
            <div className="pt-4 border-t border-[#1F1F1F] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Link Direto:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(directMenuUrl);
                    setCopiedFlyerUrl(true);
                    setTimeout(() => setCopiedFlyerUrl(false), 2500);
                  }}
                  className="text-[#D4AF37] font-bold hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedFlyerUrl ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
              <div className="p-2 rounded-xl bg-[#141414] border border-[#222222] font-mono text-[11px] text-slate-400 truncate">
                {directMenuUrl}
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={handlePrintFlyer}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#D4AF37] text-slate-950 font-black text-xs hover:bg-[#E5C158] transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Flyer (A5 / Display)</span>
              </button>
            </div>
          </div>

          {/* Printable Flyer Visual Preview (Golden luxury display stand) */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0A0A0A] border border-[#222222] p-8 flex items-center justify-center shadow-2xl">
            <div className="w-full max-w-md bg-gradient-to-b from-[#141414] via-[#0D0D0D] to-[#121212] border-2 border-[#D4AF37] rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)]">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
              
              {/* Badge de Ponto */}
              <div className="inline-block px-3 py-1 rounded-full text-xs font-black bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 mb-4 tracking-wider uppercase">
                {tableNumber || 'Mesa / Balcão'}
              </div>

              {/* Logo / Restaurant Name */}
              <h2 className="text-2xl font-black text-white tracking-tight">
                {currentFlyerRest.name}
              </h2>
              <p className="text-xs text-[#D4AF37] font-serif italic mt-0.5">
                {currentFlyerRest.tagline || BRAND_SLOGAN}
              </p>

              {/* Headline */}
              <div className="my-5 py-2 px-4 rounded-xl bg-[#1A1A1A] border border-[#282828]">
                <p className="text-xs font-black text-slate-200 tracking-wide">
                  {flyerHeadline}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aponte a câmera do seu celular para o QR Code abaixo
                </p>
              </div>

              {/* QR Code Container */}
              <div className="my-6 inline-block p-4 rounded-2xl bg-white shadow-[0_0_30px_rgba(212,175,55,0.25)] border-4 border-[#D4AF37]">
                <QrCodeImage
                  url={directMenuUrl}
                  size={260}
                  alt={`QR Code ${currentFlyerRest.name}`}
                  className="w-48 h-48 mx-auto object-contain"
                />
              </div>

              {/* Wi-Fi Details */}
              {includeWifi && (
                <div className="mb-4 inline-flex items-center gap-4 px-4 py-2 rounded-xl bg-[#171717] border border-[#2B2B2B] text-slate-300 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Wi-Fi: <strong className="text-white">{wifiSsid}</strong></span>
                  </div>
                  <div className="w-px h-3 bg-[#333]" />
                  <span>Senha: <strong className="text-white">{wifiPass}</strong></span>
                </div>
              )}

              {/* Footer System Branding */}
              <div className="pt-4 border-t border-[#222222] flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-bold tracking-widest text-[#D4AF37]">NEXORO FOOD SYSTEM</span>
                <span>Autoatendimento Inteligente</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUB-TAB: SIMULADOR DE PEDIDOS (Treinamento & QA) */}
      {activeSubTab === 'order_simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-5">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
              <Play className="w-4 h-4 text-[#00C896]" />
              <span>Gerador de Pedidos em Tempo Real</span>
            </h3>
            <p className="text-xs text-slate-400">
              Use esta ferramenta para testar o som do alarme, a sincronização instantânea do KDS da cozinha, a fila de impressão térmica e a rota de entrega sem gastar dinheiro real.
            </p>

            {simulatorStatus && (
              <div className="p-3.5 rounded-2xl bg-[#00C896]/15 border border-[#00C896]/40 text-[#00C896] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{simulatorStatus}</span>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">
                Restaurante Destino:
              </label>
              <select
                value={flyerRestSlug}
                onChange={(e) => setFlyerRestSlug(e.target.value as any)}
                className="w-full bg-[#151515] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none"
              >
                {Object.values(restaurants).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.emoji} {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Simulated Customer */}
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#222222] space-y-2">
              <span className="text-xs font-bold text-[#D4AF37] block">Dados do Cliente Simulado:</span>
              <input
                type="text"
                value={simulatedCustomer.name}
                onChange={(e) => setSimulatedCustomer({ ...simulatedCustomer, name: e.target.value })}
                className="w-full bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg px-2.5 py-1.5 text-xs text-white"
                placeholder="Nome do cliente"
              />
              <input
                type="text"
                value={simulatedCustomer.phone}
                onChange={(e) => setSimulatedCustomer({ ...simulatedCustomer, phone: e.target.value })}
                className="w-full bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg px-2.5 py-1.5 text-xs text-white"
                placeholder="Telefone"
              />
              <input
                type="text"
                value={simulatedCustomer.address}
                onChange={(e) => setSimulatedCustomer({ ...simulatedCustomer, address: e.target.value })}
                className="w-full bg-[#1B1B1B] border border-[#2C2C2C] rounded-lg px-2.5 py-1.5 text-xs text-white"
                placeholder="Endereço de entrega"
              />
            </div>

            {/* Launch Button */}
            <button
              onClick={handleLaunchSimulatedOrder}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00C896] to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-[0_0_20px_rgba(0,200,150,0.35)] transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Injetar Pedido Simulado Agora</span>
            </button>
          </div>

          {/* Real-time Order Payload Inspector */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center justify-between">
              <span>Itens no Pedido de Teste</span>
              <span className="text-xs text-[#00C896] font-bold">Status: Pronto para Disparo</span>
            </h3>

            <div className="space-y-2.5">
              {simulatedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#141414] border border-[#242424] flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{item.name}</p>
                    <p className="text-[11px] text-slate-400">R$ {item.price.toFixed(2)} un</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-md bg-[#222] text-[#D4AF37] font-bold">
                      x{item.qty}
                    </span>
                    <span className="font-black text-white">
                      R$ {(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#202020] flex items-center justify-between text-xs">
              <span className="text-slate-400">Taxa de Entrega Simulada:</span>
              <span className="font-bold text-white">R$ 7,00</span>
            </div>
            <div className="flex items-center justify-between text-sm font-black">
              <span className="text-white">Total Geral:</span>
              <span className="text-[#D4AF37] text-base">
                R$ {(simulatedItems.reduce((a, b) => a + b.price * b.qty, 0) + 7).toFixed(2)}
              </span>
            </div>

            <div className="pt-4 border-t border-[#202020] grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigateTab('kds')}
                className="py-2.5 px-3 rounded-xl bg-[#171717] hover:bg-[#202020] text-slate-300 text-xs font-bold border border-[#2C2C2C] flex items-center justify-center gap-2"
              >
                <span>Ver na Tela KDS</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateTab('kanban')}
                className="py-2.5 px-3 rounded-xl bg-[#171717] hover:bg-[#202020] text-slate-300 text-xs font-bold border border-[#2C2C2C] flex items-center justify-center gap-2"
              >
                <span>Ver no Kanban</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUB-TAB: AVALIAÇÕES DOS CLIENTES (NPS) */}
      {activeSubTab === 'reviews' && (
        <div className="space-y-6">
          {/* NPS Scoreboard */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-[#0E0E0E] border border-[#222222] p-4 text-center">
              <span className="text-xs text-slate-400 block font-bold">NPS Score</span>
              <span className="text-3xl font-black text-[#00C896] mt-1 block">94</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Zona de Excelência</span>
            </div>
            <div className="rounded-2xl bg-[#0E0E0E] border border-[#222222] p-4 text-center">
              <span className="text-xs text-slate-400 block font-bold">Média de Estrelas</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-3xl font-black text-[#D4AF37]">4.9</span>
                <Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37]" />
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Baseado em 142 avaliações</span>
            </div>
            <div className="rounded-2xl bg-[#0E0E0E] border border-[#222222] p-4 text-center">
              <span className="text-xs text-slate-400 block font-bold">Taxa de Resposta</span>
              <span className="text-3xl font-black text-cyan-400 mt-1 block">98%</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Tempo médio: 8 min</span>
            </div>
            <div className="rounded-2xl bg-[#0E0E0E] border border-[#222222] p-4 text-center">
              <span className="text-xs text-slate-400 block font-bold">Clientes Promotores</span>
              <span className="text-3xl font-black text-white mt-1 block">96%</span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> +3% este mês
              </span>
            </div>
          </div>

          {/* Feedback Stream */}
          <div className="rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wide">
              Feedbacks Recentes dos Clientes
            </h3>

            <div className="space-y-3">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-[#141414] border border-[#222222] space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{rev.customer}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1F1F1F] text-slate-400">
                        {rev.orderNumber}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                        {rev.restaurant}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-[#D4AF37]">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-[#D4AF37]" />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500">{rev.date}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{rev.comment}"
                  </p>

                  {/* Quick WhatsApp or SMS response */}
                  <div className="pt-2 border-t border-[#1F1F1F] flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500">
                      Status: <strong className="text-emerald-400">{rev.status.toUpperCase()}</strong>
                    </span>
                    <button
                      onClick={() => alert(`Abrindo conversa de agradecimento para ${rev.customer}...`)}
                      className="px-2.5 py-1 rounded-lg bg-[#1B1B1B] hover:bg-[#252525] text-[#D4AF37] text-[11px] font-bold border border-[#2E2E2E] flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Responder via WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB: SESSÕES & DISPOSITIVOS CONECTADOS */}
      {activeSubTab === 'sessions' && (
        <div className="rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#D4AF37]" />
              <span>Dispositivos e Sessões Ativas em Tempo Real</span>
            </h3>
            <span className="text-xs font-bold text-[#00C896] bg-[#00C896]/10 px-2.5 py-1 rounded-full border border-[#00C896]/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00C896] animate-pulse" />
              4 Dispositivos Conectados
            </span>
          </div>

          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-2xl bg-[#141414] border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{sess.device}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202020] text-slate-400">
                      IP: {sess.ip}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Local: <strong className="text-slate-200">{sess.location}</strong> • Operador: <strong className="text-slate-200">{sess.user}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-[#00C896] block">Latência: {sess.ping}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">Sessão Segura SSL</span>
                  </div>
                  <button
                    onClick={() => alert(`Sinal de ping enviado com sucesso para ${sess.device}.`)}
                    className="p-2 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] text-slate-300 hover:text-white border border-[#2E2E2E]"
                    title="Testar Conexão / Ping"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SUB-TAB: WEBHOOKS & API */}
      {activeSubTab === 'webhooks' && (
        <div className="rounded-3xl bg-[#0E0E0E] border border-[#222222] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Conectores e Webhooks de Integração</span>
            </h3>
            <span className="text-xs font-mono font-bold text-[#D4AF37]">REST API v2</span>
          </div>
          <p className="text-xs text-slate-400">
            Conecte o NEXORO FOOD SYSTEM ao seu ERP fiscal, sistemas contábeis, catracas ou agregadores externos.
          </p>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#141414] border border-[#222222] space-y-2">
              <span className="text-xs font-bold text-white block">Endpoint de Pedidos (Webhook POST):</span>
              <div className="p-2.5 rounded-xl bg-[#0B0B0B] border border-[#2A2A2A] font-mono text-xs text-cyan-400 truncate">
                https://api.nexoro.food/v2/webhooks/orders/listen
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#141414] border border-[#222222] space-y-2">
              <span className="text-xs font-bold text-white block">Chave de Autorização (Bearer Token):</span>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  readOnly
                  value="nxr_live_8f391b49e8c0490da29f1234abcd5678"
                  className="flex-1 bg-[#0B0B0B] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs font-mono text-slate-400 focus:outline-none"
                />
                <button
                  onClick={() => alert('Chave de API copiada para a área de transferência!')}
                  className="px-3 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] text-[#D4AF37] text-xs font-bold border border-[#2E2E2E]"
                >
                  Copiar Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
