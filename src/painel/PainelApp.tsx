import React, { Component, ErrorInfo, Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LogOut, Loader2, ShieldAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { EnvironmentBar, OperationalEnvironment } from '../components/EnvironmentBar';
import { StaffLogin } from './StaffLogin';
import {
  AREA_LABELS,
  ROLE_LABELS,
  StaffArea,
  StaffRole,
  areaFromPathname,
  areasForRole,
  canAccessArea,
  defaultAreaForRole,
} from './access';

/**
 * PAINEL DA EQUIPE
 * Aplicativo separado do cardápio do cliente (painel.html). Nada é renderizado sem login
 * validado no servidor, e cada área só abre para os perfis autorizados. Todos os módulos são
 * carregados sob demanda (não vão para o navegador do cliente nem antes do login).
 */
const AdminModule = lazy(() => import('../modules/admin/AdminModule').then((m) => ({ default: m.AdminModule })));
const SalaoModule = lazy(() => import('../modules/salao/SalaoModule').then((m) => ({ default: m.SalaoModule })));
const BalcaoModule = lazy(() => import('../modules/balcao/BalcaoModule').then((m) => ({ default: m.BalcaoModule })));
const DeliveryModule = lazy(() => import('../modules/delivery/DeliveryModule').then((m) => ({ default: m.DeliveryModule })));
const CaixaModule = lazy(() => import('../modules/caixa/CaixaModule').then((m) => ({ default: m.CaixaModule })));
const ProducaoModule = lazy(() => import('../modules/producao/ProducaoModule').then((m) => ({ default: m.ProducaoModule })));
const CentralKanbanView = lazy(() => import('../components/CentralKanbanView').then((m) => ({ default: m.CentralKanbanView })));
const CourierPortal = lazy(() => import('../components/CourierPortal').then((m) => ({ default: m.CourierPortal })));

const ENV_TO_AREA: Partial<Record<OperationalEnvironment, StaffArea>> = {
  pdv: 'pdv',
  balcao: 'balcao',
  delivery: 'delivery',
  kanban: 'kanban',
  caixa: 'caixa',
  cozinha: 'cozinha',
  sushibar: 'sushibar',
  bar: 'bar',
  admin: 'admin',
};

const AREA_TO_ENV: Record<StaffArea, OperationalEnvironment> = {
  admin: 'admin',
  pdv: 'pdv',
  balcao: 'balcao',
  delivery: 'delivery',
  kanban: 'kanban',
  caixa: 'caixa',
  cozinha: 'cozinha',
  sushibar: 'sushibar',
  bar: 'bar',
  courier: 'delivery',
};

class ModuleErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PAINEL] Falha ao carregar módulo:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-[#0E121B] p-6 text-center">
            <h2 className="text-lg font-black">Não foi possível abrir esta ferramenta</h2>
            <p className="mt-2 text-sm text-slate-400">O módulo encontrou um erro ao carregar. Volte ao painel e tente novamente.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-slate-950"
            >
              RECARREGAR
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Loading = () => (
  <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

export function PainelApp() {
  const { currentUser, loginUser, logoutUser } = useStore();
  const role = currentUser?.role;

  // A navegação das ferramentas do painel é interna ao React.
  // Não altera a URL nem cria links /pdv, /balcao, /caixa etc.
  const [area, setArea] = useState<StaffArea | null>(() => areaFromPathname(window.location.pathname));
  const [adminInitialTab, setAdminInitialTab] = useState<any>('dashboard');

  const goArea = useCallback((next: StaffArea) => {
    // Troca somente o módulo montado; a URL permanece na página atual.
    setArea(next);
  }, []);

  // Sessão derrubada pelo servidor (expirou, usuário desativado, senha trocada...)
  useEffect(() => {
    const onUnauthorized = () => {
      if (sessionStorage.getItem('tokio_staff_token')) logoutUser();
    };
    window.addEventListener('nx-staff-unauthorized', onUnauthorized);
    return () => window.removeEventListener('nx-staff-unauthorized', onUnauthorized);
  }, [logoutUser]);

  // Depois do login (ou em /painel sem área): abre a área padrão do perfil
  useEffect(() => {
    if (!currentUser) return;
    if (area === null) {
      const def = defaultAreaForRole(role);
      if (def) goArea(def);
    }
  }, [currentUser?.id, area]);

  const handleNavigateEnvironment = (env: OperationalEnvironment, subOption?: string) => {
    if (env === 'cliente') {
      // Cardápio público: outra tela (aplicativo separado)
      window.location.assign('/');
      return;
    }
    const target = ENV_TO_AREA[env];
    if (!target || !canAccessArea(role, target)) return;
    if (target === 'admin' && subOption) setAdminInitialTab(subOption);
    goArea(target);
  };

  const backToStart = () => {
    const def = defaultAreaForRole(role);
    if (def && area !== def) goArea(def);
    else setArea(null);
  };

  if (!currentUser) {
    return <StaffLogin onLogin={loginUser} />;
  }

  const allowed = areasForRole(role);
  const logoutChip = (
    <button
      onClick={() => {
        logoutUser();
        setArea(null);
      }}
      className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0B0F19]/95 border border-slate-700 text-[11px] text-slate-300 hover:text-white hover:border-amber-500/60 shadow-lg"
      title="Encerrar sessão"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>
        @{currentUser.username} • Sair
      </span>
    </button>
  );

  // Área inexistente ou sem permissão
  if (!area || !canAccessArea(role, area)) {
    return (
      <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0E121B] border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-white">{area ? 'Acesso não autorizado' : 'Área não encontrada'}</h1>
          <p className="text-xs text-slate-400">
            Seu perfil é <b className="text-amber-400">{ROLE_LABELS[role as StaffRole] || role}</b>.
            {area ? ` Ele não tem permissão para "${AREA_LABELS[area]}".` : ''} Escolha uma das áreas liberadas:
          </p>
          <div className="flex flex-col gap-2">
            {allowed.map((a) => (
              <button
                key={a}
                onClick={() => goArea(a)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                {AREA_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
        {logoutChip}
      </div>
    );
  }

  const withBar = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#07090E] flex flex-col">
      <EnvironmentBar currentEnvironment={AREA_TO_ENV[area]} onSelectEnvironment={handleNavigateEnvironment} />
      <div className="flex-1">{content}</div>
    </div>
  );

  let screen: React.ReactNode;
  switch (area) {
    case 'admin':
      screen = withBar(<AdminModule onBackToApp={backToStart} initialTab={adminInitialTab} />);
      break;
    case 'pdv':
      screen = (
        <SalaoModule
          onBackToApp={backToStart}
          onOpenAdmin={canAccessArea(role, 'admin') ? () => goArea('admin') : undefined}
          onNavigateToEnvironment={handleNavigateEnvironment}
        />
      );
      break;
    case 'balcao':
      screen = withBar(
        <BalcaoModule onBackToApp={backToStart} onOpenAdmin={canAccessArea(role, 'admin') ? () => goArea('admin') : undefined} />
      );
      break;
    case 'delivery':
      screen = withBar(<DeliveryModule onBackToApp={backToStart} />);
      break;
    case 'kanban':
      screen = withBar(<CentralKanbanView onBackToApp={backToStart} />);
      break;
    case 'caixa':
      screen = withBar(<CaixaModule onBackToApp={backToStart} />);
      break;
    case 'cozinha':
    case 'sushibar':
    case 'bar':
      screen = withBar(<ProducaoModule key={area} initialStation={area} onBackToApp={backToStart} />);
      break;
    case 'courier':
      screen = (
        <div className="min-h-screen bg-[#07090E]">
          <CourierPortal onBackToHome={backToStart} />
        </div>
      );
      break;
    default:
      screen = null;
  }

  return (
    <>
      <ModuleErrorBoundary><Suspense fallback={<Loading />}>{screen}</Suspense></ModuleErrorBoundary>
      {logoutChip}
    </>
  );
}
