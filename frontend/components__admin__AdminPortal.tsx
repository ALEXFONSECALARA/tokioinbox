import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MenuItem, Category, Order, OrderStatus, RestaurantConfig, DriverInfo } from './types';
import {
  adminLogin,
  adminUserLogin,
  fetchRestaurantsAdmin,
  setRestaurantActive,
  fetchMenu,
  fetchOrdersAdmin,
  updateOrderAdmin,
  saveMenuItems,
  saveCategories,
  saveRestaurantConfig,
  fetchPlatformSettings,
  savePlatformSettings,
  deleteOrderAdmin,
  clearOrderHistory,
  subscribeToOrderEvents,
  createOrder,
  PlatformSettings,
  RestaurantSummary,
} from './utils__api';
import { AdminDashboard } from './components__admin__AdminDashboard';
import { ConnectionBanner } from './components__system__ConnectionBanner';
import { AdminUsersPanel } from './components__admin__AdminUsersPanel';
import { playSoundEffect, playOrderAlertSound, playDelayedOrderAlertSound, unlockOrderAlertAudio } from './utils__helpers';
import { LAYOUTS } from './utils__layouts';
import { LayoutPreviewModal } from './components__admin__LayoutPreviewModal';
import { Lock, ShieldCheck, Palette, ChevronDown, Check, Eye, Power, AlertTriangle, X } from 'lucide-react';

const TOKEN_KEY = 'super_admin_token';

// Defesa em profundidade: o backend já consulta pedidos por restaurant_id,
// mas o painel também exige o escopo explícito restaurantSlug. Assim, mesmo
// que um dado antigo/órfão ou resposta de uma versão anterior chegue ao
// navegador, ele nunca aparece no Kanban do restaurante errado.
const onlyRestaurantOrders = (orders: Order[], slug: string): Order[] =>
  orders.filter((order) => order.restaurantSlug === slug);

const KNOWN_LOGINS_KEY = 'tokioinbox_known_logins';

function loadKnownLogins(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_LOGINS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((l) => typeof l === 'string') : [];
  } catch {
    return [];
  }
}

function rememberLogin(login: string) {
  try {
    const list = loadKnownLogins().filter((l) => l !== login);
    list.unshift(login);
    localStorage.setItem(KNOWN_LOGINS_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    // localStorage indisponível (modo privado etc) — não é crítico, só não sugere depois
  }
}

const LoginScreen: React.FC<{ onLoggedIn: (token: string) => void }> = ({ onLoggedIn }) => {
  // Fase 4 (item 17): além da senha única de sempre, um usuário individual
  // (criado em "Usuários e Permissões") pode entrar com login+senha próprios.
  // As duas formas convivem — nenhuma substitui a outra.
  const [mode, setMode] = useState<'master' | 'user'>('master');
  const [password, setPassword] = useState('');
  const [login, setLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Logins usados antes neste dispositivo (evolução — "login já cadastrado
  // pode aparecer como opção clicável, preenchendo somente o login; nunca
  // mostrar/salvar senha"). Só o NOME de usuário fica salvo, em texto
  // simples, no localStorage deste navegador — a senha nunca é gravada em
  // lugar nenhum, sempre precisa ser digitada.
  const [knownLogins, setKnownLogins] = useState<string[]>(() => loadKnownLogins());

  const finishLogin = (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    // Toque no botão de login = gesto do usuário — aproveita pra destravar
    // o áudio no iOS/Safari antes do primeiro pedido de verdade chegar
    // (sem isso, o primeiro alerta sonoro pode simplesmente não tocar).
    unlockOrderAlertAudio();
    onLoggedIn(token);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'master') {
        finishLogin(await adminLogin(password));
      } else {
        const { token } = await adminUserLogin(login, userPassword);
        rememberLogin(login.trim());
        finishLogin(token);
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-4">
          <Lock size={22} />
        </div>
        <h1 className="text-xl font-bold text-stone-900 mb-1">Painel do administrador</h1>
        <p className="text-sm text-stone-500 mb-4">
          {mode === 'master' ? 'Acesso único para gerenciar todos os restaurantes' : 'Entre com seu login individual'}
        </p>

        {mode === 'master' ? (
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
        ) : (
          <>
            <input
              autoFocus
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Login"
              className="w-full border border-stone-300 rounded-xl px-4 py-3 mb-1.5 focus:outline-none focus:ring-2 focus:ring-stone-800"
            />
            {knownLogins.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {knownLogins.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLogin(l)}
                    className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
            <input
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Senha"
              className="w-full border border-stone-300 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-stone-800"
            />
          </>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading || (mode === 'master' ? !password : !login || !userPassword)}
          className="w-full bg-stone-900 text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'master' ? 'user' : 'master');
            setError(null);
          }}
          className="block w-full text-center text-xs text-stone-500 mt-4 hover:text-stone-800"
        >
          {mode === 'master' ? 'Entrar com login de usuário →' : '← Entrar com a senha única'}
        </button>
        <a href="/" className="block text-center text-sm text-stone-500 mt-2 hover:text-stone-800">
          ← Voltar
        </a>
      </form>
    </div>
  );
};

// Painel da vitrine principal "/" — título, subtítulo e layout de fundo
// compartilhados por TODOS os restaurantes na página "Escolha seu
// restaurante". Diferente das Configurações de cada restaurante (essas
// continuam em AdminDashboard): isto é global, por isso mora aqui, na barra
// do super-admin, e não dentro do painel de um restaurante específico.
const PlatformSettingsPanel: React.FC<{ token: string; restaurants: RestaurantSummary[] }> = ({ token, restaurants }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchPlatformSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  if (!settings) return null;

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    savePlatformSettings(token, settings)
      .then((saved) => {
        setSettings(saved);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .catch((err) => console.error('Erro ao salvar configuração da vitrine:', err))
      .finally(() => setSaving(false));
  };

  return (
    <div className="bg-stone-800 border-t border-stone-700">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-300 hover:text-white"
      >
        <Palette size={14} />
        <span>Vitrine Principal (página "Escolha seu restaurante")</span>
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 max-w-2xl">
          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">Título</label>
            <input
              type="text"
              value={settings.landingTitle}
              onChange={(e) => setSettings({ ...settings, landingTitle: e.target.value })}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">Subtítulo</label>
            <input
              type="text"
              value={settings.landingSubtitle}
              onChange={(e) => setSettings({ ...settings, landingSubtitle: e.target.value })}
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-400 mb-1">Layout de fundo</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, landingLayout: l.id })}
                  className={`text-[10px] font-bold px-2 py-2 rounded-lg border-2 ${l.pageBg} ${l.pageText} ${
                    settings.landingLayout === l.id ? 'border-amber-500' : 'border-transparent opacity-70'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                <Check size={14} /> Salvo!
              </span>
            )}
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-white text-xs font-bold"
            >
              <Eye size={14} /> Pré-visualizar
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="text-xs text-stone-400 hover:text-white ml-auto">
              Ver vitrine →
            </a>
          </div>
        </div>
      )}

      {showPreview && settings && (
        <LayoutPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          title={settings.landingTitle}
          subtitle={settings.landingSubtitle}
          pageLayout={settings.landingLayout}
          restaurants={restaurants.map((r) => ({
            slug: r.slug,
            name: r.name,
            tagline: r.tagline,
            photo: r.bannerImage || r.logo,
            color: r.color,
            secondaryColor: r.secondaryColor,
            layout: r.layout,
            bannerPositionX: r.bannerPositionX,
            bannerPositionY: r.bannerPositionY,
            bannerZoom: r.bannerZoom,
          }))}
        />
      )}
    </div>
  );
};

export const AdminPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // Slug de quem os dados abaixo (menuItems/categories/restaurantConfig/orders)
  // realmente pertencem no momento — só muda quando uma resposta da API chega.
  // Evita a "tela em branco piscando dado errado": enquanto loadedSlug !==
  // selectedSlug, mostramos um overlay de carregamento por cima do painel.
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null);
  // Ref sincronizado com restaurantConfig pra usar dentro do listener SSE
  // sem precisar recriar a inscrição (EventSource) toda vez que a config
  // muda — só precisamos do valor mais atual no momento do evento.
  const restaurantConfigRef = useRef<RestaurantConfig | null>(null);
  useEffect(() => { restaurantConfigRef.current = restaurantConfig; }, [restaurantConfig]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  // Alerta sonoro de "pedido chegando" (persistido no dispositivo, não no
  // restaurante — cada tela/celular na cozinha pode preferir volume/som
  // diferente). O toggle de ligar/desligar já existia no AdminDashboard mas
  // não fazia nada de verdade — agora é aqui, junto de quem detecta pedido
  // novo de fato.
  const [realtimeState, setRealtimeState] = useState<'connecting'|'online'|'reconnecting'|'offline'>('connecting');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('tokioinbox_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Destrava o áudio em QUALQUER toque/clique enquanto o admin está logado —
  // não só no botão de login. Numa cozinha real, o celular pode ficar minutos
  // parado esperando um pedido; nesse tempo o Safari/iOS suspende o
  // AudioContext de novo, e sem um toque recente o beep falha silenciosamente
  // (o PC costuma tocar porque o Chrome desktop é mais permissivo com
  // autoplay). Isso é o motivo mais provável do alerta soar no PC e não no
  // celular mesmo os dois recebendo o mesmo evento ao mesmo tempo.
  useEffect(() => {
    if (!token) return;
    const unlock = () => unlockOrderAlertAudio();
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [token]);

  // Notificação do sistema operacional (item: aviso simultâneo PC/mobile) —
  // canal redundante ao beep: não depende de gesto recente do usuário (só da
  // permissão, pedida uma vez) e aparece mesmo com a aba em segundo plano ou
  // o som mudo. Silenciosa de propósito se o navegador não suportar/negar.
  useEffect(() => {
    if (!token || typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [token]);

  const notifyNewOrderSystem = useCallback((orderNumber: number | undefined) => {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const n = new Notification('🔔 Novo pedido recebido', {
        body: orderNumber ? `Pedido #${orderNumber} — toque para abrir o painel.` : 'Toque para abrir o painel.',
        tag: 'tokioinbox-new-order', // substitui a notificação anterior em vez de empilhar
        renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      // Notificação é reforço, nunca pode travar o resto do painel.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('tokioinbox_sound_enabled', String(soundEnabled));
    } catch {
      // localStorage bloqueado — sem problema, só não persiste entre sessões
    }
  }, [soundEnabled]);
  // IDs de pedidos já vistos, pra tocar o alerta só quando um pedido
  // GENUINAMENTE novo chega (não em toda troca de status de um já existente).
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const pendingAlertIdsRef = useRef<Set<string>>(new Set());
  const lastVoiceAlertAtRef = useRef<Record<string, number>>({});
  // Alerta de PEDIDO ATRASADO (evolução v25, prioridade 4) — compara o
  // horário do pedido + tempo estimado (já calculado no checkout, salvo em
  // order.estimatedMinutes) com "agora". Alerta uma vez quando cruza o
  // prazo, e de novo a cada 5 min enquanto continuar atrasado e não
  // finalizado, pra não deixar ninguém esquecer.
  const delayedAlertedAtRef = useRef<Record<string, number>>({});
  const [delayedOrderIds, setDelayedOrderIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const REALERT_INTERVAL_MS = 5 * 60 * 1000;
    const check = () => {
      const now = Date.now();
      const stillDelayed = new Set<string>();
      for (const order of orders) {
        if (order.status === 'entregue' || order.status === 'cancelado') continue;
        const minutes = order.estimatedMinutes || 35;
        const deadline = new Date(order.createdAt).getTime() + minutes * 60000;
        if (now < deadline) continue;
        stillDelayed.add(order.id);
        const lastAlertedAt = delayedAlertedAtRef.current[order.id] || 0;
        if (now - lastAlertedAt >= REALERT_INTERVAL_MS) {
          delayedAlertedAtRef.current[order.id] = now;
          if (soundEnabled) {
            playDelayedOrderAlertSound();
            try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
          }
        }
      }
      setDelayedOrderIds(stillDelayed);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [orders, soundEnabled]);
  // Auto-save acontece em muitos campos do painel. Sem uma fila, dois PUTs
  // simultâneos podem terminar fora de ordem e o segundo salvar uma versão
  // antiga da configuração — especialmente perceptível ao adicionar fotos
  // na sequência de abertura.
  const configSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  // Alterações não salvas no formulário de Configurações do restaurante atual
  // (ver AdminDashboard → onDirtyChange). Usado pra confirmar antes de trocar
  // de restaurante ou sair, e pra travar a barra de troca durante o salvamento.
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Erro visível de "salvar falhou" (Fase 4) — antes, um PUT que falhasse
  // (sessão expirada, rede caiu, erro do Supabase) só ia pro console.error:
  // o admin via a mudança na tela (atualização otimista) e achava que tinha
  // salvo, mas o servidor nunca recebeu. Essa foi a causa raiz real por
  // trás de "troquei a foto e não salvou" — o upload em si sempre funcionou.
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sempre a versão mais recente do slug pedido — usada dentro dos efeitos
  // assíncronos abaixo pra descartar respostas que chegaram atrasadas (race
  // condition clássica de trocar de restaurante rápido demais).
  const latestRequestedSlugRef = React.useRef<string | null>(null);

  const handleLogout = useCallback(() => {
    if (isDirty && !window.confirm('Você tem alterações não salvas nas Configurações. Sair mesmo assim e perdê-las?')) {
      return;
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, [isDirty]);

  // Troca de restaurante: se houver edição não salva, confirma antes. Isso
  // cobre exatamente o cenário "trocar rapidamente entre restaurantes" sem
  // perceber que uma alteração ficou pra trás.
  const handleSelectRestaurant = useCallback(
    (slug: string) => {
      if (slug === selectedSlug) return;
      if (isDirty && !window.confirm('Você tem alterações não salvas nas Configurações deste restaurante. Trocar de restaurante mesmo assim e perdê-las?')) {
        return;
      }
      setIsDirty(false);
      pendingAlertIdsRef.current.clear();
      lastVoiceAlertAtRef.current = {};
      setOrders([]);
      setLoadedSlug(null);
      setSelectedSlug(slug);
    },
    [selectedSlug, isDirty]
  );

  // Carrega a lista de TODOS os restaurantes (ativos e inativos) assim que
  // loga — o super-admin precisa ver e poder reativar os desativados aqui,
  // diferente da vitrine pública "/" (que só mostra os ativos).
  const reloadRestaurants = useCallback(() => {
    if (!token) return;
    fetchRestaurantsAdmin(token)
      .then((list) => {
        setRestaurants(list);
        setSelectedSlug((prev) => prev || (list.length > 0 ? list[0].slug : null));
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    reloadRestaurants();
  }, [reloadRestaurants]);

  const handleToggleActive = useCallback(
    (r: RestaurantSummary) => {
      if (!token) return;
      const turningOff = r.active !== false;
      const confirmMsg = turningOff
        ? `Desativar "${r.name}"? Ele deixa de aparecer na tela inicial e para de receber novos pedidos, mas nada é apagado — dá pra reativar quando quiser.`
        : `Reativar "${r.name}"? Ele volta a aparecer na tela inicial e a receber pedidos normalmente.`;
      if (!window.confirm(confirmMsg)) return;
      setRestaurants((prev) => prev.map((x) => (x.slug === r.slug ? { ...x, active: !turningOff } : x)));
      setRestaurantActive(token, r.slug, !turningOff)
        .catch((err) => {
          console.error('Erro ao alterar status do restaurante:', err);
          reloadRestaurants();
        });
    },
    [token, reloadRestaurants]
  );

  // Carrega cardápio + config + pedidos SEMPRE do restaurante selecionado no
  // momento em que a resposta chega — nunca de um selectedSlug antigo. Se o
  // admin trocar de restaurante de novo antes da resposta anterior voltar, o
  // resultado antigo é descartado (comparação com latestRequestedSlugRef).
  useEffect(() => {
    if (!token || !selectedSlug) return;
    latestRequestedSlugRef.current = selectedSlug;
    const requestedSlug = selectedSlug;
    setLoading(true);
    Promise.all([fetchMenu(requestedSlug), fetchOrdersAdmin(requestedSlug, token)])
      .then(([menu, orderList]) => {
        // Uma seleção mais nova já foi feita enquanto isso carregava — descarta.
        if (latestRequestedSlugRef.current !== requestedSlug) return;
        setMenuItems(menu.menuItems);
        setCategories(menu.categories);
        setRestaurantConfig(menu.restaurantConfig);
        setOrders(onlyRestaurantOrders(orderList, requestedSlug));
        setLoadedSlug(requestedSlug);
        // Marca os pedidos já existentes como "conhecidos" ANTES de começar o
        // polling — sem isso, abrir um restaurante com pedidos pendentes
        // dispararia o alarme de "pedido novo" pra pedidos que já estavam lá.
        knownOrderIdsRef.current = new Set(orderList.map((o) => o.id));
      })
      .catch((err: any) => {
        if (latestRequestedSlugRef.current !== requestedSlug) return;
        if (String(err?.message || '').includes('Não autorizado')) {
          handleLogout();
        }
      })
      .finally(() => {
        if (latestRequestedSlugRef.current === requestedSlug) setLoading(false);
      });
  }, [token, selectedSlug, handleLogout]);

  // Atualiza os pedidos periodicamente (novo pedido chegando de um cliente) e
  // toca o alerta sonoro quando um pedido GENUINAMENTE novo aparece — o
  // toggle "Som Ativado" no painel (AdminDashboard) já existia mas não
  // tocava nada de verdade antes desta correção. Descarta a resposta se,
  // entre o disparo e a resposta, o admin já tiver trocado de restaurante
  // (mesma proteção contra race condition de cima).
  useEffect(() => {
    if (!token || !selectedSlug) return;
    const slugAtScheduleTime = selectedSlug;
    const refreshOrders = () => {
      fetchOrdersAdmin(slugAtScheduleTime, token).then((list) => {
        if (latestRequestedSlugRef.current !== slugAtScheduleTime) return;
        const known = knownOrderIdsRef.current;
        const scopedList = onlyRestaurantOrders(list, slugAtScheduleTime);
        const newOnes = known ? scopedList.filter((o) => !known.has(o.id)) : [];
        if (newOnes.length > 0) {
          newOnes.filter(o => o.status === 'recebido').forEach(o => pendingAlertIdsRef.current.add(o.id));
          if (soundEnabled) { playOrderAlertSound(); try { navigator.vibrate?.([250,120,250]); } catch {} }
          newOnes.filter(o => o.status === 'recebido').forEach(o => notifyNewOrderSystem(o.orderNumber));
        }
        scopedList.forEach(o => { if (o.status !== 'recebido') pendingAlertIdsRef.current.delete(o.id); });
        knownOrderIdsRef.current = new Set(scopedList.map(o => o.id));
        setOrders(scopedList);
      }).catch(() => {});
    };
    const onManualRefresh = () => refreshOrders();
    window.addEventListener('tokio:admin-refresh-orders', onManualRefresh);
    const interval = setInterval(refreshOrders, 2500);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshOrders(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); window.removeEventListener('tokio:admin-refresh-orders', onManualRefresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [token, selectedSlug, soundEnabled, notifyNewOrderSystem]);

  // Canal em tempo real: todos os painéis conectados ao mesmo restaurante recebem
  // a mesma mudança assim que o servidor grava. O polling continua como fallback.
  useEffect(() => {
    if (!token || !selectedSlug) return;
    const stop = subscribeToOrderEvents(selectedSlug, token, (event) => {
      if (event.type === 'created' && event.status === 'recebido' && event.orderId) {
        pendingAlertIdsRef.current.add(event.orderId);
        if (soundEnabled) { playOrderAlertSound(); try { navigator.vibrate?.([300,120,300]); } catch {} }
        notifyNewOrderSystem(event.orderNumber);
      }
      if (event.type === 'updated' && event.orderId && event.status !== 'recebido') pendingAlertIdsRef.current.delete(event.orderId);
      fetchOrdersAdmin(selectedSlug, token).then(next => {
        if (latestRequestedSlugRef.current !== selectedSlug) return;
        const scopedNext = onlyRestaurantOrders(next, selectedSlug);
        knownOrderIdsRef.current = new Set(scopedNext.map(o => o.id));
        setOrders(scopedNext);
        // Impressão automática (item pedido: o sistema deve receber o pedido
        // e imprimir ao mesmo tempo em que ele aparece no app/Kanban, sem
        // depender de clique manual). Se "Imprimir novos pedidos
        // automaticamente" estiver ligado nas configurações deste
        // restaurante, assim que o pedido novo chega por realtime a gente
        // avisa o AdminDashboard (que já cuida da impressora térmica real
        // via Print Bridge no backend, e também pode imprimir direto pelo
        // navegador se este painel estiver aberto).
        if (event.type === 'created' && event.orderId && restaurantConfigRef.current?.printAutoNewOrders) {
          const newOrder = scopedNext.find(o => o.id === event.orderId);
          if (newOrder) window.dispatchEvent(new CustomEvent('tokio:auto-print-order', { detail: { order: newOrder } }));
        }
      }).catch(() => {});
    }, undefined, 'admin', setRealtimeState);
    return stop;
  }, [token, selectedSlug, soundEnabled, notifyNewOrderSystem]);

  useEffect(()=>{if(!token||!selectedSlug||!soundEnabled)return;const tick=()=>{const ids=[...pendingAlertIdsRef.current];if(!ids.length)return;playOrderAlertSound();try{navigator.vibrate?.([300,120,300])}catch{}const now=Date.now();ids.forEach(id=>{const last=lastVoiceAlertAtRef.current[id]||0;if(now-last>12000&&'speechSynthesis' in window){const o=orders.find(x=>x.id===id);if(o){const u=new SpeechSynthesisUtterance(`Novo pedido ${o.orderNumber}. Toque para aceitar.`);u.lang='pt-BR';u.rate=1.05;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);lastVoiceAlertAtRef.current[id]=now}}})};const t=setInterval(tick,4500);return()=>clearInterval(t)},[token,selectedSlug,soundEnabled,orders]);

  const handleDeleteOrder = useCallback(async(orderId:string)=>{if(!selectedSlug||!token)return false;try{await deleteOrderAdmin(selectedSlug,token,orderId);pendingAlertIdsRef.current.delete(orderId);setOrders(prev=>prev.filter(o=>o.id!==orderId));return true}catch(err:any){alert(err?.message||'Não foi possível excluir o pedido.');return false}},[selectedSlug,token]);
  const pendingAlerts = orders.filter(o => o.status === 'recebido' && pendingAlertIdsRef.current.has(o.id));
  const acceptPendingOrder = useCallback(async () => {
    const order = pendingAlerts[0];
    if (!order || !selectedSlug || !token) return;
    try {
      await updateOrderAdmin(selectedSlug, token, order.id, { status: 'em_preparo' });
      pendingAlertIdsRef.current.delete(order.id);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'em_preparo' } : o));
      try { navigator.vibrate?.([80,60,80]); } catch {}
    } catch (err:any) {
      alert(err?.message || 'Não foi possível aceitar o pedido.');
    }
  }, [pendingAlerts, selectedSlug, token]);
  const handleClearHistory = useCallback(async(password?:string)=>{if(!selectedSlug||!token)return false;try{const removed=await clearOrderHistory(selectedSlug,token,password);setOrders(prev=>prev.filter(o=>!['entregue','cancelado'].includes(o.status)));alert(`${removed} pedido(s) removido(s) do histórico.`);return true}catch(err:any){throw err}},[selectedSlug,token]);
  const handleInjectDemoOrder = useCallback(async (order: Order) => {
    if (!selectedSlug || (order.restaurantSlug && order.restaurantSlug !== selectedSlug)) return;
    const scopedOrder = { ...order, restaurantSlug: selectedSlug };
    // Corrigido: antes este simulador só atualizava o estado local (React),
    // sem gravar no servidor — o pedido de teste "sumia" no próximo refresh/
    // poll (que sobrescreve `orders` com a lista real do banco) e nunca
    // aparecia em outro dispositivo. Agora passa pelo mesmo POST que um
    // pedido de verdade, então persiste, sincroniza e se comporta igual.
    try {
      await createOrder(selectedSlug, scopedOrder);
      knownOrderIdsRef.current = new Set([scopedOrder.id, ...(knownOrderIdsRef.current ? [...knownOrderIdsRef.current] : [])]);
      pendingAlertIdsRef.current.add(scopedOrder.id);
      setOrders(prev => [scopedOrder, ...prev.filter(o => o.id !== scopedOrder.id)]);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível criar o pedido de teste no servidor.');
    }
  }, [selectedSlug]);

  if (!token) {
    return <LoginScreen onLoggedIn={setToken} />;
  }

  // Só considera "pronto pra mostrar" quando os dados carregados (loadedSlug)
  // realmente são os do restaurante selecionado agora — nunca mostra dado de
  // um restaurante antigo com a aba de outro já destacada.
  const isSwitchingRestaurant = selectedSlug !== loadedSlug;
  if (!selectedSlug || !restaurantConfig || isSwitchingRestaurant) {
    const switchingTo = restaurants.find((r) => r.slug === selectedSlug);
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
        {switchingTo && (
          <p className="text-sm text-stone-500">
            Carregando dados de {switchingTo.emoji} {switchingTo.name}...
          </p>
        )}
      </div>
    );
  }

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus, driver?: DriverInfo, cancelReason?: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const patch: Partial<Order> = { status, ...(driver ? { driver } : {}), ...(status === 'cancelado' ? { cancelReason: cancelReason || target.cancelReason } : {}) };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
    playSoundEffect('notification');
    updateOrderAdmin(selectedSlug, token, orderId, patch, target.updatedAt).then((serverOrder) => {
      setOrders((prev) => prev.map((o) => (o.id === serverOrder.id ? serverOrder : o)));
    }).catch((err: any) => {
      if (err?.message?.includes('alterado em outro dispositivo')) {
        fetchOrdersAdmin(selectedSlug, token).then(setOrders).catch(() => {});
      } else {
        setOrders((prev) => prev.map((o) => (o.id === target.id ? target : o)));
        console.error('Erro ao atualizar pedido:', err);
      }
    });
  };

  const persistMenuItems = async (items: MenuItem[]): Promise<boolean> => {
    const previous = menuItems; // pra reverter se o servidor recusar/falhar
    setMenuItems(items);
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveMenuItems(selectedSlug, token, items);
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar itens:', err);
      setMenuItems(previous); // desfaz a atualização otimista — a tela não mente sobre o que foi salvo
      setSaveError(err?.message || 'Não foi possível salvar o cardápio. Tente novamente.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMenuItem = (item: MenuItem) => persistMenuItems([item, ...menuItems]);
  const handleUpdateMenuItem = (item: MenuItem) =>
    persistMenuItems(menuItems.map((i) => (i.id === item.id ? item : i)));
  const handleDeleteMenuItem = (id: string) => persistMenuItems(menuItems.filter((i) => i.id !== id));
  const handleToggleAvailability = (id: string) => {
    persistMenuItems(menuItems.map((i) => (i.id === id ? { ...i, available: !i.available } : i)));
    playSoundEffect('beep');
  };

  const persistCategories = async (next: Category[]): Promise<boolean> => {
    const previous = categories;
    setCategories(next);
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveCategories(selectedSlug, token, next);
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar categorias:', err);
      setCategories(previous);
      setSaveError(err?.message || 'Não foi possível salvar as categorias. Tente novamente.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Retorna Promise<boolean> (salvou ou não) — a maioria dos chamadores (mais
  // de 20 pontos de auto-save: badges, entrega, ajuste operacional etc.)
  // ignora o retorno e continua funcionando igual antes. Só os formulários
  // com modal (prato/motoboy/bairro) usam o retorno pra decidir se fecham o
  // modal — antes fechavam sempre, mesmo quando o salvamento falhava, e o
  // admin via a janela sumir como se tivesse dado certo enquanto o erro de
  // verdade só aparecia depois, num banner lá em cima. Essa foi a causa real
  // de "Salvar Alterações não funciona" nesta rodada.
  const handleUpdateConfig = (config: RestaurantConfig): Promise<boolean> => {
    setRestaurantConfig(config);
    setIsSaving(true);
    setSaveError(null);

    // Enfileira os PUTs sem deixar requisições concorrentes sobrescreverem
    // umas às outras. Cada chamada espera a anterior terminar e envia a
    // versão que foi criada naquele momento.
    const operation = configSaveQueueRef.current
      .catch(() => true)
      .then(async () => {
        try {
          await saveRestaurantConfig(selectedSlug, token, config);
          return true;
        } catch (err: any) {
          console.error('Erro ao salvar configuração:', err);
          setSaveError(err?.message || 'Não foi possível salvar. Tente novamente.');
          return false;
        }
      });

    configSaveQueueRef.current = operation;
    operation.finally(() => {
      if (configSaveQueueRef.current === operation) setIsSaving(false);
    });
    return operation;
  };

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Alerta de conexão (evolução v25, prioridade 1) — 🟢🟡🔴, com alarme
          sonoro contínuo enquanto offline e ressincronização automática dos
          pedidos assim que a conexão volta. */}
      <ConnectionBanner
        soundEnabled={soundEnabled}
        onReconnect={() => window.dispatchEvent(new Event('tokio:admin-refresh-orders'))}
      />
      {/* Alerta visual de pedido(s) atrasado(s) (evolução v25, prioridade 4) —
          o som já tocou (ver useEffect acima); isto fica visível até o
          pedido avançar de status ou ser cancelado. */}
      {delayedOrderIds.size > 0 && (
        <div className="fixed top-2 right-2 z-[9997] bg-red-600 text-white rounded-2xl shadow-xl px-3 py-2 text-xs font-bold max-w-[90vw]">
          ⏰ {delayedOrderIds.size} pedido(s) atrasado(s): #
          {orders.filter((o) => delayedOrderIds.has(o.id)).map((o) => o.orderNumber).join(', #')}
        </div>
      )}
      {/* Banner de erro ao salvar (Fase 4) — antes uma falha ficava só no
          console.error, invisível pro admin, que achava que tinha salvo. */}
      {saveError && (
        <div className="bg-rose-600 text-white px-4 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="p-1 rounded-lg hover:bg-rose-700 shrink-0" title="Fechar aviso">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Barra de troca de restaurante do super-admin */}
      <div className="bg-stone-900 text-white px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
        <span className="flex items-center gap-1.5 text-xs font-medium text-stone-400 shrink-0">
          <ShieldCheck size={14} /> Super-admin
        </span>
        {restaurants.map((r) => {
          const isInactive = r.active === false;
          return (
            <div
              key={r.slug}
              className={`flex items-center rounded-full whitespace-nowrap shrink-0 ${
                r.slug === selectedSlug ? 'bg-white text-stone-900' : 'text-stone-300 hover:bg-stone-800'
              } ${isInactive ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => handleSelectRestaurant(r.slug)}
                disabled={isSaving && r.slug !== selectedSlug}
                title={
                  isSaving && r.slug !== selectedSlug
                    ? 'Aguarde o salvamento terminar antes de trocar de restaurante'
                    : isInactive
                    ? 'Restaurante desativado — invisível na tela inicial'
                    : undefined
                }
                className={`text-sm pl-3 pr-1.5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  r.slug === selectedSlug ? 'font-medium' : ''
                }`}
              >
                {r.emoji} {r.name}
                {isInactive && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-stone-400">inativo</span>}
                {r.slug === selectedSlug && isDirty && (
                  <span className="ml-1.5 text-amber-500" title="Alterações não salvas">●</span>
                )}
              </button>
              <button
                onClick={() => handleToggleActive(r)}
                title={isInactive ? 'Reativar restaurante' : 'Desativar restaurante'}
                className={`p-1.5 mr-1 rounded-full transition-colors ${
                  isInactive
                    ? 'text-emerald-500 hover:bg-emerald-500/20'
                    : r.slug === selectedSlug
                    ? 'text-stone-400 hover:bg-stone-200'
                    : 'text-stone-500 hover:bg-stone-800'
                }`}
              >
                <Power size={13} />
              </button>
            </div>
          );
        })}
        <span className={`text-[11px] font-bold shrink-0 ${realtimeState === 'online' ? 'text-emerald-500' : realtimeState === 'reconnecting' ? 'text-amber-500' : 'text-stone-400'}`}>● {realtimeState === 'online' ? 'Sincronizado' : realtimeState === 'reconnecting' ? 'Reconectando…' : realtimeState === 'connecting' ? 'Conectando…' : 'Offline'}</span>
        {isSaving && (
          <span className="text-[11px] text-amber-400 font-semibold shrink-0 animate-pulse">Salvando...</span>
        )}
        <button
          onClick={handleLogout}
          className="ml-auto text-xs text-stone-400 hover:text-white shrink-0"
        >
          Sair
        </button>
      </div>

      <div data-admin-platform><PlatformSettingsPanel token={token} restaurants={restaurants} /></div>
      <div data-admin-users><AdminUsersPanel token={token} restaurants={restaurants} /></div>

      {pendingAlerts.length > 0 && (
        <button
          onClick={acceptPendingOrder}
          className="fixed left-3 right-3 bottom-4 z-[80] md:left-auto md:right-5 md:w-[380px] rounded-2xl bg-emerald-600 text-white px-4 py-3.5 shadow-2xl border border-emerald-300/30 flex items-center gap-3 active:scale-[.98] transition-transform"
          aria-label={`Aceitar pedido ${pendingAlerts[0].orderNumber}`}
        >
          <span className="w-3 h-3 rounded-full bg-white animate-pulse shrink-0" />
          <span className="text-left flex-1"><strong className="block text-sm font-black">PEDIDO #{pendingAlerts[0].orderNumber}</strong><span className="text-xs text-emerald-50">Toque para aceitar e enviar para preparo</span></span>
          <span className="text-xs font-black bg-white/15 px-2 py-1 rounded-lg">ACEITAR</span>
        </button>
      )}

      <AdminDashboard
        key={selectedSlug}
        slug={selectedSlug}
        token={token}
        otherRestaurants={restaurants.filter((r) => r.slug !== selectedSlug)}
        orders={orders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
        onClearOrderHistory={handleClearHistory}
        menuItems={menuItems}
        categories={categories}
        onAddMenuItem={handleAddMenuItem}
        onUpdateMenuItem={handleUpdateMenuItem}
        onDeleteMenuItem={handleDeleteMenuItem}
        onToggleAvailability={handleToggleAvailability}
        onInjectDemoOrder={handleInjectDemoOrder}
        onUpdateMenuItems={persistMenuItems}
        onUpdateCategories={persistCategories}
        restaurantConfig={restaurantConfig}
        onUpdateConfig={handleUpdateConfig}
        onCloseAdmin={() => (window.location.href = '/')}
        onDirtyChange={setIsDirty}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        onOpenPlatform={() => document.querySelector('[data-admin-platform]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onOpenUsers={() => document.querySelector('[data-admin-users]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
    </div>
  );
};
