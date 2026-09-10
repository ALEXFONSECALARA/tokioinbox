import React, { useEffect, useState } from 'react';
import { 
  MenuItem, 
  Category, 
  Order, 
  RestaurantConfig, 
  DeliveryZone,
  DriverInfo,
  PaymentMethod
} from '../types';
import { formatCurrency, playSoundEffect, COUPONS } from '../utils/helpers';
import { toPublicSlug, fetchAdminLoginLogs, fetchErrorLogs, clearAdminLoginLogs, clearErrorLogs, deleteAdminLoginLog, deleteErrorLog, fetchRestaurantHealth, RestaurantHealth, fetchDrivers, fetchBackups, createBackup } from '../utils/api';
import { 
  Wrench, 
  QrCode, 
  Calculator, 
  Download, 
  Upload, 
  Sparkles, 
  Printer, 
  Percent, 
  FileSpreadsheet, 
  Check, 
  Copy, 
  Plus, 
  Trash2, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Bike,
  RefreshCw,
  Layers,
  FileText,
  AlertCircle,
  Activity,
  CheckCircle2,
  XCircle,
  ServerCog,
  UsersRound,
  ArchiveRestore,
  ShieldCheck
} from 'lucide-react';

interface ToolsHubProps {
  orders: Order[];
  onInjectDemoOrder: (order: Order) => void;
  menuItems: MenuItem[];
  onUpdateMenuItems: (items: MenuItem[]) => void;
  restaurantConfig: RestaurantConfig;
  onUpdateConfig: (config: RestaurantConfig) => void;
  token?: string;
  slug?: string;
  onOpenPlatform?: () => void;
  onOpenUsers?: () => void;
}

export const ToolsHub: React.FC<ToolsHubProps> = ({
  orders,
  onInjectDemoOrder,
  menuItems,
  onUpdateMenuItems,
  restaurantConfig,
  onUpdateConfig,
  token,
  slug,
  onOpenPlatform,
  onOpenUsers,
}) => {
  const [activeSubTool, setActiveSubTool] = useState<
    'qr_flyer' | 'cmv_calculator' | 'demo_orders' | 'backup_export' | 'maintenance' | 'diagnostics' | 'coupons' | 'drivers' | 'production'
  >('qr_flyer');

  // ==========================================
  // 1. QR CODE & FLYER GENERATOR STATE
  // ==========================================
  const [flyerTitle, setFlyerTitle] = useState(restaurantConfig.name);
  const [flyerSubtitle, setFlyerSubtitle] = useState('Peça pelo nosso Cardápio Online & WhatsApp');
  const [flyerPromo, setFlyerPromo] = useState('Ganhe 10% OFF com o cupom: BEMVINDO10');
  const [flyerQrUrl, setFlyerQrUrl] = useState(`${window.location.origin}/${slug ? toPublicSlug(restaurantConfig.name || slug) : ''}`);
  useEffect(() => { if (slug) setFlyerQrUrl(`${window.location.origin}/${slug ? toPublicSlug(restaurantConfig.name || slug) : ''}`); }, [slug]);

  // ==========================================
  // 2. CMV / PROFIT MARGIN CALCULATOR STATE
  // ==========================================
  const [dishCostIngredients, setDishCostIngredients] = useState('12.50');
  const [dishCostPackaging, setDishCostPackaging] = useState('2.50');
  const [dishTaxCardFeePercent, setDishTaxCardFeePercent] = useState('12'); // Impostos + Taxa Cartão %
  const [targetMarginPercent, setTargetMarginPercent] = useState('45'); // Margem de lucro desejada %

  // Calculation Math
  const costDirect = (parseFloat(dishCostIngredients.replace(',', '.')) || 0) + 
                     (parseFloat(dishCostPackaging.replace(',', '.')) || 0);
  const taxPct = (parseFloat(dishTaxCardFeePercent.replace(',', '.')) || 0) / 100;
  const marginPct = (parseFloat(targetMarginPercent.replace(',', '.')) || 0) / 100;

  // Formula: Preço Sugerido = Custo Direto / (1 - (Impostos% + Margem%))
  const denominator = Math.max(0.05, 1 - (taxPct + marginPct));
  const suggestedPrice = costDirect > 0 ? costDirect / denominator : 0;
  const profitAmount = suggestedPrice * marginPct;
  const markupMultiplier = costDirect > 0 ? suggestedPrice / costDirect : 0;

  // ==========================================
  // 3. BACKUP & EXPORT DATA STATE
  // ==========================================
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [loginLogs,setLoginLogs]=useState<any[]>([]); const [health,setHealth]=useState<RestaurantHealth|null>(null); const [healthLoading,setHealthLoading]=useState(false); const [errorLogs,setErrorLogs]=useState<any[]>([]); const [logsLoading,setLogsLoading]=useState(false);
  const loadLogs=async()=>{if(!token)return;setLogsLoading(true);try{const [a,b]=await Promise.all([fetchAdminLoginLogs(token),fetchErrorLogs(token)]);setLoginLogs(a);setErrorLogs(b)}catch(err:any){alert(err?.message||'Não foi possível carregar os logs.')}finally{setLogsLoading(false)}};
  useEffect(()=>{if(activeSubTool==='maintenance')loadLogs()},[activeSubTool,token]);
  const loadHealth=async()=>{if(!token||!slug)return;setHealthLoading(true);try{setHealth(await fetchRestaurantHealth(slug,token))}catch(err:any){alert(err?.message||'Não foi possível diagnosticar o restaurante.')}finally{setHealthLoading(false)}};
  useEffect(()=>{if(activeSubTool==='diagnostics')loadHealth()},[activeSubTool,token,slug]);
  const [drivers,setDrivers]=useState<any[]>([]); const [backups,setBackups]=useState<any[]>([]);
  const loadOps=async()=>{if(!token||!slug)return;try{const [{drivers:d},{backups:b}]=await Promise.all([fetchDrivers(slug,token),fetchBackups(slug,token)]);setDrivers(d);setBackups(b)}catch(err:any){alert(err?.message||'Não foi possível carregar a operação.')}};
  useEffect(()=>{if(['drivers','production','backup_export'].includes(activeSubTool))loadOps()},[activeSubTool,token,slug]);
  const doBackup=async()=>{if(!token||!slug)return;try{await createBackup(slug,token);await loadOps();setExportSuccess('Backup persistente criado com sucesso para este restaurante.')}catch(err:any){alert(err?.message||'Falha no backup.')}};

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('Nenhum pedido registrado para exportar.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Numero_Pedido,Data_Hora,Cliente,Telefone,Bairro,Total,Subtotal,Frete,Desconto,Metodo_Pagamento,Status\n';

    orders.forEach((o) => {
      const row = [
        `#${o.orderNumber}`,
        `"${new Date(o.createdAt).toLocaleString('pt-BR')}"`,
        `"${o.customer.name}"`,
        `"${o.customer.phone}"`,
        `"${o.customer.address?.neighborhood || 'N/A'}"`,
        o.total.toFixed(2),
        o.subtotal.toFixed(2),
        o.deliveryFee.toFixed(2),
        o.discount.toFixed(2),
        `"${o.paymentMethod}"`,
        `"${o.status}"`,
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_pedidos_delivery_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportSuccess('Relatório CSV de Vendas exportado com sucesso!');
    playSoundEffect('success');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const handleExportJSON = () => {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      restaurantConfig,
      menuItems,
      orders,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup_delivery_${restaurantConfig.name.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportSuccess('Backup completo em JSON gerado com sucesso!');
    playSoundEffect('success');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.menuItems && Array.isArray(parsed.menuItems)) {
          onUpdateMenuItems(parsed.menuItems);
        }
        if (parsed.restaurantConfig) {
          onUpdateConfig(parsed.restaurantConfig);
        }
        playSoundEffect('success');
        alert('Backup restaurado com sucesso!');
      } catch (err) {
        alert('Arquivo de backup inválido.');
      }
    };
    reader.readAsText(file);
  };

  // ==========================================
  // 4. DEMO ORDER SIMULATOR
  // ==========================================
  const handleSimulateOrder = (type: 'burger' | 'pizza' | 'combo') => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const mockNames = ['Camila Rodrigues', 'Lucas Mendes', 'Juliana Fonseca', 'Rodrigo Almeida', 'Beatriz Costa'];
    const mockNeighborhoods = ['Bela Vista', 'Cerqueira César / Jardins', 'Pinheiros', 'Paraíso', 'Consolação'];
    const randomClient = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomNeighborhood = mockNeighborhoods[Math.floor(Math.random() * mockNeighborhoods.length)];

    let items = [];
    if (type === 'burger' && menuItems[0]) {
      items.push({
        id: `item-${Date.now()}-1`,
        menuItem: menuItems[0],
        quantity: 2,
        selectedChoices: [{ groupId: 'g1', groupTitle: 'Ponto da Carne', optionId: 'o1', optionName: 'Ao Ponto', price: 0 }],
        selectedExtras: [{ id: 'ex1', name: 'Bacon Crocante Extra', price: 4.5, quantity: 1 }],
        specialNotes: 'Por favor, caprichar na maionese!',
        unitPrice: menuItems[0].price + 4.5,
        totalPrice: (menuItems[0].price + 4.5) * 2,
      });
    } else if (type === 'pizza' && menuItems[2]) {
      items.push({
        id: `item-${Date.now()}-2`,
        menuItem: menuItems[2],
        quantity: 1,
        selectedChoices: [],
        selectedExtras: [{ id: 'ex2', name: 'Borda Recheada Catupiry', price: 8.0, quantity: 1 }],
        specialNotes: 'Cortar em 8 pedaços bem assadinha.',
        unitPrice: menuItems[2].price + 8.0,
        totalPrice: menuItems[2].price + 8.0,
      });
    } else {
      // Default Combo
      const dish1 = menuItems[0] || menuItems[0];
      const dish2 = menuItems[1] || menuItems[0];
      items.push(
        {
          id: `item-${Date.now()}-1`,
          menuItem: dish1,
          quantity: 1,
          selectedChoices: [],
          selectedExtras: [],
          unitPrice: dish1.price,
          totalPrice: dish1.price,
        },
        {
          id: `item-${Date.now()}-2`,
          menuItem: dish2,
          quantity: 1,
          selectedChoices: [],
          selectedExtras: [],
          unitPrice: dish2.price,
          totalPrice: dish2.price,
        }
      );
    }

    const subtotal = items.reduce((acc, i) => acc + i.totalPrice, 0);
    const deliveryFee = 7.00;
    const discount = 5.00;
    const total = subtotal + deliveryFee - discount;

    const mockOrder: Order = {
      id: `order-sim-${Date.now()}`,
      orderNumber: randomNum,
      createdAt: new Date().toISOString(),
      items,
      subtotal,
      deliveryFee,
      discount,
      couponCode: 'BEMVINDO10',
      total,
      orderType: 'delivery',
      customer: {
        name: randomClient,
        phone: '(11) 9' + Math.floor(10000000 + Math.random() * 90000000),
        address: {
          street: 'Rua das Flores',
          number: String(Math.floor(100 + Math.random() * 900)),
          neighborhood: randomNeighborhood,
          city: 'São Paulo',
          complement: 'Apt ' + Math.floor(10 + Math.random() * 90),
          reference: 'Próximo à padaria',
          cep: '01310-100',
        },
      },
      paymentMethod: 'pix',
      status: 'recebido',
      statusHistory: [
        {
          status: 'recebido',
          timestamp: new Date().toISOString(),
          note: 'Pedido simulado recebido no sistema',
        },
      ],
      notes: 'Entregar na portaria com o porteiro Silva.',
    };

    onInjectDemoOrder(mockOrder);
    playSoundEffect('notification');
    setExportSuccess(`Novo Pedido #${randomNum} simulado e injetado no Kanban com sucesso!`);
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const productionCards = activeSubTool==='production' ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><div className="rounded-2xl border p-4"><ShieldCheck size={20}/><b>Segurança</b><p className="text-sm opacity-70 mt-1">Rate limit, CORS obrigatório em produção, correlação de requisições e proteção de sessão.</p></div><div className="rounded-2xl border p-4"><ArchiveRestore size={20}/><b>Backups</b><p className="text-sm opacity-70 mt-1">{backups.length} backup(s) persistente(s).</p><button onClick={doBackup} className="mt-3 px-3 py-2 rounded-xl bg-black text-white">Criar backup agora</button></div><div className="rounded-2xl border p-4"><Printer size={20}/><b>Impressão</b><p className="text-sm opacity-70 mt-1">Fila persistente + Print Bridge com fila e recuperação de jobs.</p></div></div> : null;
  const driverCards = activeSubTool==='drivers' ? <div className="rounded-2xl border p-4 mb-6"><div className="flex items-center gap-2 mb-3"><UsersRound size={20}/><b>Entregadores</b></div><div className="grid gap-2">{drivers.map(d=><div key={d.id} className="flex justify-between border rounded-xl p-3"><span>{d.name} · {d.phone}</span><span>{d.status}</span></div>)}{!drivers.length&&<p className="text-sm opacity-60">Nenhum entregador cadastrado.</p>}</div></div> : null;
  return (
    <div className="space-y-6">
      {productionCards}{driverCards}
      {/* Header of Tools */}
      <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 font-bold">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              Central de Ferramentas do Restaurante
            </h2>
            <p className="text-xs text-stone-500">
              Utilitários para impressão, cálculo de lucratividade (CMV), materiais promocionais e gestão de dados
            </p>
          </div>
        </div>

        {exportSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{exportSuccess}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={onOpenPlatform} className="rounded-2xl border border-stone-200 bg-white p-4 text-left hover:border-amber-400 hover:shadow-sm transition">
          <div className="text-sm font-black text-stone-900">Vitrine Principal</div>
          <div className="text-xs text-stone-500 mt-1">Título, destaque e apresentação da página inicial.</div>
        </button>
        <button onClick={onOpenUsers} className="rounded-2xl border border-stone-200 bg-white p-4 text-left hover:border-amber-400 hover:shadow-sm transition">
          <div className="text-sm font-black text-stone-900">Usuários e Permissões</div>
          <div className="text-xs text-stone-500 mt-1">Acessos administrativos e clientes da plataforma.</div>
        </button>
      </div>

      {/* Sub Tools Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveSubTool('qr_flyer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTool === 'qr_flyer'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Gerador de Flyer & QR Code</span>
        </button>

        <button
          onClick={() => setActiveSubTool('cmv_calculator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTool === 'cmv_calculator'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Calculadora CMV & Precificação</span>
        </button>

        <button
          onClick={() => setActiveSubTool('demo_orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTool === 'demo_orders'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Simulador de Pedidos (Testes)</span>
        </button>

        <button onClick={() => setActiveSubTool('diagnostics')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap ${activeSubTool==='diagnostics'?'bg-amber-500 text-slate-950 font-black shadow-xs':'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}><Activity className="w-4 h-4"/><span>Diagnóstico</span></button>

        <button onClick={() => setActiveSubTool('maintenance')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap ${activeSubTool==='maintenance'?'bg-amber-500 text-slate-950 font-black shadow-xs':'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}><Wrench className="w-4 h-4"/><span>Históricos & Logs</span></button>

        <button onClick={() => setActiveSubTool('production')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap ${activeSubTool==='production'?'bg-amber-500 text-slate-950 font-black shadow-xs':'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}><ShieldCheck className="w-4 h-4"/><span>Produção</span></button>
        <button onClick={() => setActiveSubTool('drivers')} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap ${activeSubTool==='drivers'?'bg-amber-500 text-slate-950 font-black shadow-xs':'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}><UsersRound className="w-4 h-4"/><span>Entregadores</span></button>
        <button
          onClick={() => setActiveSubTool('backup_export')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTool === 'backup_export'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Backup & Exportação CSV / JSON</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOOL: QR CODE & FLYER GENERATOR */}
      {/* ========================================================================= */}
      {activeSubTool === 'qr_flyer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Form */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4 text-amber-500" />
              <span>Personalizar Flyer / Display de Mesa</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Título do Estabelecimento</label>
                <input
                  type="text"
                  value={flyerTitle}
                  onChange={(e) => setFlyerTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Subtítulo / Chamada</label>
                <input
                  type="text"
                  value={flyerSubtitle}
                  onChange={(e) => setFlyerSubtitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Texto Promocional / Cupom</label>
                <input
                  type="text"
                  value={flyerPromo}
                  onChange={(e) => setFlyerPromo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">URL de Destino do QR Code</label>
                <input
                  type="text"
                  value={flyerQrUrl}
                  onChange={(e) => setFlyerQrUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Cartaz / Display de Balcão (A4/A5)</span>
              </button>
            </div>
          </div>

          {/* Printable Flyer Preview */}
          <div className="lg:col-span-7 flex justify-center items-center bg-stone-200/60 p-6 rounded-3xl border border-stone-300">
            <div
              id="printable-flyer"
              className="bg-white text-slate-950 w-full max-w-sm rounded-3xl shadow-xl border-4 border-slate-900 p-6 text-center space-y-4 select-text"
            >
              {/* Flyer Top Header */}
              <div className="space-y-1">
                <div className="w-14 h-14 bg-amber-500 text-slate-950 font-black rounded-2xl flex items-center justify-center mx-auto text-xl shadow-md border-2 border-slate-950">
                  🔥
                </div>
                <h2 className="text-xl font-black tracking-tight">{flyerTitle}</h2>
                <p className="text-xs font-semibold text-stone-600 max-w-xs mx-auto">
                  {flyerSubtitle}
                </p>
              </div>

              {/* QR Code Frame */}
              <div className="bg-stone-50 p-4 rounded-2xl border-2 border-dashed border-stone-400 inline-block shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    flyerQrUrl
                  )}`}
                  alt="QR Code do Cardápio"
                  className="w-40 h-40 mx-auto rounded-lg"
                />
                <p className="text-[10px] font-bold text-stone-500 mt-2">
                  📱 Aponte a câmera do celular
                </p>
              </div>

              {/* Promo Banner on Flyer */}
              {flyerPromo && (
                <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl font-black text-xs border border-amber-600 shadow-xs">
                  🎁 {flyerPromo}
                </div>
              )}

              {/* Footer info */}
              <div className="text-[11px] text-stone-500 space-y-0.5 pt-2 border-t border-stone-200">
                <p className="font-bold text-stone-800">🛵 Pedidos rápidos via WhatsApp: {restaurantConfig.whatsapp}</p>
                <p>{restaurantConfig.address}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOOL: CMV / PROFIT MARGIN & PRICING CALCULATOR */}
      {/* ========================================================================= */}
      {activeSubTool === 'cmv_calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-6 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span>Simulador de Custos e Engenharia de Preço</span>
            </h3>
            <p className="text-xs text-stone-500">
              Descubra o preço de venda ideal para manter o CMV (Custo de Mercadoria Vendida) saudável e lucrativo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Custo dos Ingredientes (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-stone-400 font-bold">R$</span>
                  <input
                    type="text"
                    value={dishCostIngredients}
                    onChange={(e) => setDishCostIngredients(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Custo da Embalagem Delivery (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-stone-400 font-bold">R$</span>
                  <input
                    type="text"
                    value={dishCostPackaging}
                    onChange={(e) => setDishCostPackaging(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Taxas de Cartão + Impostos (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={dishTaxCardFeePercent}
                    onChange={(e) => setDishTaxCardFeePercent(e.target.value)}
                    className="w-full pr-8 pl-3 py-2 rounded-xl border border-stone-300 font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-stone-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Margem de Lucro Desejada (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetMarginPercent}
                    onChange={(e) => setTargetMarginPercent(e.target.value)}
                    className="w-full pr-8 pl-3 py-2 rounded-xl border border-stone-300 font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-stone-400 font-bold">%</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs space-y-1">
              <div className="flex justify-between text-stone-600">
                <span>Custo Direto Total (Insumos + Caixa):</span>
                <span className="font-bold text-stone-900">{formatCurrency(costDirect)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Markup Multiplicador Recomendado:</span>
                <span className="font-black text-amber-700">{markupMultiplier.toFixed(2)}x</span>
              </div>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="lg:col-span-6 bg-gradient-to-br from-stone-900 to-slate-950 text-white p-6 rounded-3xl border border-stone-800 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Resultado da Engenharia de Cardápio
              </span>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 text-white">
                {formatCurrency(suggestedPrice)}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Preço de venda sugerido para atingir {targetMarginPercent}% de lucro líquido por unidade
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-stone-800">
              <div className="bg-stone-800/80 p-3 rounded-2xl">
                <span className="text-[11px] text-stone-400">Lucro Líquido Unitário</span>
                <p className="text-lg font-black text-emerald-400">{formatCurrency(profitAmount)}</p>
              </div>

              <div className="bg-stone-800/80 p-3 rounded-2xl">
                <span className="text-[11px] text-stone-400">CMV Teórico</span>
                <p className="text-lg font-black text-amber-300">
                  {suggestedPrice > 0 ? ((costDirect / suggestedPrice) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="text-[11px] text-stone-400 leading-relaxed bg-stone-800/40 p-3 rounded-xl">
              💡 <strong>Dica do Especialista:</strong> No setor de alimentação e delivery, o CMV ideal fica entre <strong>28% e 35%</strong>. Se o CMV estiver acima de 40%, considere renegociar fornecedores ou revisar porções.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TOOL: DEMO ORDERS SIMULATOR (TEST SYSTEM) */}
      {/* ========================================================================= */}
      {activeSubTool === 'demo_orders' && (
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Simulador de Novos Pedidos Delivery (Testes de Fluxo)</span>
            </h3>
            <p className="text-xs text-stone-500">
              Clique para injetar pedidos fictícios realistas com clientes, endereços e itens para testar os alertas sonoros, a esteira Kanban e a atribuição de motoboy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xl">🍔</span>
                <h4 className="font-black text-stone-900 text-sm mt-1">Pedido Duplo de Burgers</h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  2x Smash Burger com adicionais de bacon, refrigerante e pagamento via PIX.
                </p>
              </div>
              <button
                onClick={() => handleSimulateOrder('burger')}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Injetar no Kanban</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xl">🍕</span>
                <h4 className="font-black text-stone-900 text-sm mt-1">Pedido Pizza Especial</h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  1x Pizza Grande com borda recheada, bairro distante e observação da cozinha.
                </p>
              </div>
              <button
                onClick={() => handleSimulateOrder('pizza')}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Injetar no Kanban</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xl">🥤</span>
                <h4 className="font-black text-stone-900 text-sm mt-1">Combo Completo</h4>
                <p className="text-xs text-stone-600 mt-0.5">
                  Prato principal + Sobremesa + Bebida com cupom promocional aplicado.
                </p>
              </div>
              <button
                onClick={() => handleSimulateOrder('combo')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Injetar no Kanban</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TOOL: BACKUP & DATA EXPORT (CSV / JSON) */}
      {/* ========================================================================= */}
      {activeSubTool === 'backup_export' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* CSV Sales Export */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <div className="p-2.5 w-fit rounded-xl bg-emerald-100 text-emerald-800 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-sm">Exportar Vendas para Planilha (.CSV)</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Baixe uma planilha compatível com Excel e Google Planilhas contendo todos os pedidos, clientes, valores, taxas de entrega e bairros.
            </p>
            <button
              onClick={handleExportCSV}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Relatório de Vendas (.CSV)</span>
            </button>
          </div>

          {/* Full JSON Backup & Restore */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <div className="p-2.5 w-fit rounded-xl bg-purple-100 text-purple-800 font-bold">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-sm">Backup Completo do Sistema (.JSON)</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Exporte todos os pratos, categorias, configurações, taxas de bairros e motoboys cadastrados para segurança.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={handleExportJSON}
                className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Backup</span>
              </button>

              <label className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl text-center cursor-pointer flex items-center justify-center gap-1.5">
                <Upload className="w-4 h-4" />
                <span>Restaurar (.JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}
      {activeSubTool === 'diagnostics' && (
        <div className="space-y-5">
          <div className="bg-stone-900 text-white rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><div className="flex items-center gap-2 text-xs font-bold text-stone-300"><ServerCog className="w-4 h-4"/> SAÚDE OPERACIONAL</div><h3 className="text-xl font-black mt-1">{health?.restaurant?.name || restaurantConfig.name}</h3><p className="text-xs text-stone-400 mt-1">Validação do cardápio, pedidos, tempo de resposta e recursos conectados.</p></div>
            <button onClick={loadHealth} disabled={healthLoading} className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${healthLoading?'animate-spin':''}`}/> Atualizar diagnóstico</button>
          </div>
          {health && <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[['Produtos',health.metrics.products],['Categorias',health.metrics.categories],['Pedidos ativos',health.metrics.activeOrders],['Pedidos totais',health.metrics.totalOrders],['Conexões realtime',health.metrics.realtimeClients]].map(([label,value])=><div key={String(label)} className="bg-white border border-stone-200 rounded-2xl p-4"><div className="text-[10px] uppercase font-black text-stone-400">{label}</div><div className="text-2xl font-black text-stone-900 mt-1">{value}</div></div>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white border border-stone-200 rounded-3xl p-5 space-y-3"><h4 className="font-black text-sm">Checklist</h4>{(health.issues.length?health.issues:[{key:'ok',severity:'info',message:'Nenhum problema encontrado no diagnóstico atual.'}]).map((issue:any)=><div key={issue.key} className="flex items-start gap-3 p-3 rounded-2xl bg-stone-50"><span className="mt-0.5">{issue.severity==='error'?<XCircle className="w-4 h-4 text-rose-600"/>:issue.severity==='warning'?<AlertCircle className="w-4 h-4 text-amber-600"/>:<CheckCircle2 className="w-4 h-4 text-emerald-600"/>}</span><span className="text-xs font-semibold text-stone-700">{issue.message}</span></div>)}</div>
              <div className="bg-white border border-stone-200 rounded-3xl p-5"><h4 className="font-black text-sm mb-3">Infraestrutura</h4><div className="space-y-2 text-xs">{[['Banco',health.capabilities.dataBackend],['Imagens',health.capabilities.storageMode],['Push',health.capabilities.pushConfigured?'Configurado':'Não configurado'],['IA',health.capabilities.aiConfigured?'Configurada':'Não configurada'],['Tempo de diagnóstico',`${health.latencyMs||0} ms`]].map(([a,b])=><div key={String(a)} className="flex justify-between border-b border-stone-100 py-2"><span className="text-stone-500">{a}</span><b className="text-stone-800">{b}</b></div>)}</div></div>
            </div>
          </>}
        </div>
      )}

      {activeSubTool === 'maintenance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2"><div><h3 className="font-extrabold text-stone-900 flex items-center gap-2"><FileText className="w-4 h-4 text-amber-600"/> Histórico de login</h3><p className="text-[11px] text-stone-500">Registros dos acessos ao painel. Pode excluir um por um ou limpar todos.</p></div><button onClick={async()=>{if(!token||!window.confirm('Excluir todo o histórico de login?'))return;await clearAdminLoginLogs(token);setLoginLogs([])}} className="text-[11px] font-bold text-rose-700 px-2 py-1 rounded-lg bg-rose-50">Limpar tudo</button></div>
            {logsLoading?<p className="text-xs text-stone-400">Carregando...</p>:loginLogs.length===0?<p className="text-xs text-stone-400">Nenhum registro.</p>:<div className="max-h-80 overflow-y-auto space-y-1">{loginLogs.map(l=><div key={l.id} className="flex items-center justify-between gap-2 border border-stone-100 rounded-xl p-2.5 text-[11px]"><div><b className={l.success?'text-emerald-700':'text-rose-700'}>{l.success?'Sucesso':'Falha'}</b> · {l.login||'—'} · {l.mode}<div className="text-stone-400">{new Date(l.createdAt).toLocaleString('pt-BR')}</div></div><button onClick={async()=>{if(!token)return;await deleteAdminLoginLog(token,l.id);setLoginLogs(x=>x.filter(a=>a.id!==l.id))}} className="p-2 rounded-lg bg-stone-100 text-rose-700" title="Excluir registro"><Trash2 size={13}/></button></div>)}</div>}
          </div>
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2"><div><h3 className="font-extrabold text-stone-900 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-600"/> Logs de erro</h3><p className="text-[11px] text-stone-500">Falhas registradas pelo servidor para diagnóstico.</p></div><button onClick={async()=>{if(!token||!window.confirm('Excluir todos os logs de erro?'))return;await clearErrorLogs(token);setErrorLogs([])}} className="text-[11px] font-bold text-rose-700 px-2 py-1 rounded-lg bg-rose-50">Limpar tudo</button></div>
            {logsLoading?<p className="text-xs text-stone-400">Carregando...</p>:errorLogs.length===0?<p className="text-xs text-stone-400">Nenhum erro registrado.</p>:<div className="max-h-80 overflow-y-auto space-y-1">{errorLogs.map(l=><div key={l.id} className="flex items-start justify-between gap-2 border border-stone-100 rounded-xl p-2.5 text-[11px]"><div className="min-w-0"><b className="text-rose-700">{l.context||'Erro'}</b><p className="text-stone-700 break-words">{l.message}</p><div className="text-stone-400">{new Date(l.createdAt).toLocaleString('pt-BR')}{l.restaurantSlug?` · ${l.restaurantSlug}`:''}</div></div><button onClick={async()=>{if(!token)return;await deleteErrorLog(token,l.id);setErrorLogs(x=>x.filter(a=>a.id!==l.id))}} className="p-2 rounded-lg bg-stone-100 text-rose-700 shrink-0" title="Excluir log"><Trash2 size={13}/></button></div>)}</div>}
          </div>
        </div>
      )}

    </div>
  );
};
