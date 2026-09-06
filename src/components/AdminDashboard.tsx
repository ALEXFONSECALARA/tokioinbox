import React, { useState, useEffect } from 'react';
import { 
  MenuItem, 
  Category, 
  Order, 
  OrderStatus, 
  RestaurantConfig, 
  DietaryTag,
  DeliveryZone,
  DriverInfo,
  PromoBadge,
  RestaurantBadge
} from '../types';
import {
  formatCurrency,
  playSoundEffect,
  normalizeSplashImage,
  DEFAULT_BADGES,
  getBadgeInfo,
  ORDER_ALERT_SOUNDS,
  getSelectedOrderAlertSoundId,
  setSelectedOrderAlertSoundId,
  playOrderAlertSound,
  unlockOrderAlertAudio,
} from '../utils/helpers';
import { fetchMenu, toPublicSlug } from '../utils/api';
import { LAYOUTS } from '../utils/layouts';
import { ToolsHub } from './ToolsHub';
import { ReceiptPrintModal } from './ReceiptPrintModal';
import { createPrintJob, updatePrintJob } from '../utils/api';
import { ImageUploadField } from './ImageUploadField';
import { LayoutPreviewModal } from './LayoutPreviewModal';
import { 
  ChefHat, 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Phone, 
  Save, 
  Check, 
  Clock, 
  Volume2, 
  VolumeX, 
  Layers, 
  Settings, 
  Eye, 
  X,
  Bike,
  MapPin,
  QrCode,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Navigation,
  ShieldCheck,
  Percent,
  Printer,
  Wrench,
  Sparkles,
  FileSpreadsheet,
  ImageOff,
  Images,
  Palette,
  LayoutGrid,
  Move,
  ChevronUp,
  ChevronDown,
  Copy
} from 'lucide-react';
import { Tag, Music, CheckSquare, Bell } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';
import { AdminAiPanel } from './AdminAiPanel';

interface AdminDashboardProps {
  // Restaurante sendo administrado e token de sessão do admin — necessários
  // pra fazer upload de fotos (POST /api/:slug/upload) direto do painel.
  slug: string;
  token: string;
  // Lista dos demais restaurantes (slug + nome) — usada só pra oferecer
  // "copiar de outro restaurante" em Bairros&Taxas e Entregadores. Nunca
  // grava nada nesses restaurantes, só lê pra copiar.
  otherRestaurants?: { slug: string; name: string }[];
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driver?: DriverInfo, cancelReason?: string) => void;
  onDeleteOrder?: (orderId: string) => Promise<boolean>;
  onClearOrderHistory?: () => Promise<boolean>;
  menuItems: MenuItem[];
  categories: Category[];
  onAddMenuItem: (item: MenuItem) => Promise<boolean>;
  onUpdateMenuItem: (item: MenuItem) => Promise<boolean>;
  onDeleteMenuItem: (id: string) => void;
  onToggleAvailability: (id: string) => void;
  onInjectDemoOrder?: (order: Order) => void;
  onUpdateMenuItems?: (items: MenuItem[]) => void;
  // Salva a lista de categorias (Fase 4 — Categorias por restaurante). Opcional
  // por compatibilidade, mas sempre presente na prática (AdminPortal já passa).
  onUpdateCategories?: (categories: Category[]) => Promise<boolean>;
  restaurantConfig: RestaurantConfig;
  onUpdateConfig: (config: RestaurantConfig) => Promise<boolean>;
  onCloseAdmin: () => void;
  // Ligar/desligar alerta sonoro de pedido novo (Fase 4) — o estado real
  // mora no AdminPortal, que é quem detecta o pedido chegando via polling;
  // aqui só controla o toggle visual e o painel de escolher/testar o som.
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenPlatform?: () => void;
  onOpenUsers?: () => void;
  // Avisa o painel pai (AdminPortal) se existem edições no formulário de
  // Configurações ainda não salvas — usado pra impedir troca de restaurante
  // sem confirmação e perda acidental de alterações.
  onDirtyChange?: (dirty: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  slug,
  token,
  otherRestaurants,
  orders,
  onUpdateOrderStatus,
  onDeleteOrder,
  onClearOrderHistory,
  menuItems,
  categories,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onToggleAvailability,
  onInjectDemoOrder,
  onUpdateMenuItems,
  onUpdateCategories,
  restaurantConfig,
  onUpdateConfig,
  onCloseAdmin,
  soundEnabled,
  onToggleSound,
  onOpenPlatform,
  onOpenUsers,
  onDirtyChange,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'identity' | 'zones' | 'drivers' | 'config' | 'metrics' | 'tools' | 'notifications' | 'ai'>('orders');
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [selectedAlertSoundId, setSelectedAlertSoundId] = useState(getSelectedOrderAlertSoundId);

  // ---------- Categorias do cardápio (Fase 4) ----------
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | 'new' | null>(null);
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [categoryDraftIcon, setCategoryDraftIcon] = useState('');
  const [categoryDraftImage, setCategoryDraftImage] = useState('');
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  // Categoria que o admin tentou excluir mas ainda tem produtos — pede pra
  // escolher outra categoria de destino antes de seguir com a exclusão
  // (nunca apaga produto junto com a categoria).
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<Category | null>(null);
  const [moveProductsTargetId, setMoveProductsTargetId] = useState('');
  const [categorySaveError, setCategorySaveError] = useState<string | null>(null);

  const persistCategories = (next: Category[]) => onUpdateCategories?.(next) ?? Promise.resolve(true);

  const openNewCategoryForm = () => {
    setEditingCategoryId('new');
    setCategoryDraftName('');
    setCategoryDraftIcon('');
    setCategoryDraftImage('');
  };
  const openEditCategoryForm = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryDraftName(cat.name);
    setCategoryDraftIcon(cat.icon || '');
    setCategoryDraftImage(cat.image || '');
  };
  const closeCategoryForm = () => {
    setEditingCategoryId(null);
    setCategorySaveError(null);
  };

  const saveCategoryForm = async () => {
    const name = categoryDraftName.trim();
    if (!name || categoryImageUploading) return; // ver comentário em handleSaveDishSubmit
    setCategorySaveError(null);
    let ok: boolean;
    if (editingCategoryId === 'new') {
      const id = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `categoria-${Date.now()}`;
      const uniqueId = categories.some((c) => c.id === id) ? `${id}-${Date.now().toString().slice(-4)}` : id;
      const newCategory: Category = {
        id: uniqueId,
        name,
        icon: categoryDraftIcon.trim() || 'Layers',
        image: categoryDraftImage || undefined,
        active: true,
      };
      ok = await persistCategories([...categories, newCategory]);
    } else if (editingCategoryId) {
      ok = await persistCategories(
        categories.map((c) =>
          c.id === editingCategoryId
            ? { ...c, name, icon: categoryDraftIcon.trim() || c.icon, image: categoryDraftImage || undefined }
            : c
        )
      );
    } else {
      return;
    }
    if (ok) {
      closeCategoryForm();
    } else {
      setCategorySaveError('Não foi possível salvar. Veja o aviso no topo da tela e tente de novo.');
    }
  };

  const moveCategory = (id: string, direction: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === id);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= categories.length) return;
    const next = [...categories];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    persistCategories(next);
  };

  const toggleCategoryActive = (cat: Category) => {
    persistCategories(categories.map((c) => (c.id === cat.id ? { ...c, active: c.active === false } : c)));
  };

  const requestDeleteCategory = (cat: Category) => {
    const productCount = menuItems.filter((i) => i.categoryId === cat.id).length;
    if (productCount > 0) {
      // Não apaga produtos junto — pede pra escolher outra categoria antes.
      setCategoryPendingDelete(cat);
      setMoveProductsTargetId(categories.find((c) => c.id !== cat.id)?.id || '');
      return;
    }
    if (!confirm(`Excluir a categoria "${cat.name}"? Ela não tem produtos, então nada mais é afetado.`)) return;
    persistCategories(categories.filter((c) => c.id !== cat.id));
  };

  const confirmMoveProductsAndDelete = () => {
    if (!categoryPendingDelete || !moveProductsTargetId) return;
    const updatedItems = menuItems.map((i) =>
      i.categoryId === categoryPendingDelete.id ? { ...i, categoryId: moveProductsTargetId } : i
    );
    onUpdateMenuItems?.(updatedItems);
    persistCategories(categories.filter((c) => c.id !== categoryPendingDelete.id));
    setCategoryPendingDelete(null);
    setMoveProductsTargetId('');
  };

  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  // Pedidos já impressos nesta sessão do painel (troca o botão pra
  // "Reimprimir" e deixa claro que os dados usados são os mesmos salvos).
  const [printStates, setPrintStates] = useState<Record<string, 'pendente' | 'imprimindo' | 'impresso' | 'erro'>>({});
  const setPrintState = (orderId: string, state: 'pendente' | 'imprimindo' | 'impresso' | 'erro') => {
    setPrintStates(prev => { const next = { ...prev, [orderId]: state }; try { localStorage.setItem(`tokioinbox_print_state_${slug}`, JSON.stringify(next)); } catch {} return next; });
  };
  useEffect(() => { try { const raw = localStorage.getItem(`tokioinbox_print_state_${slug}`); if (raw) setPrintStates(JSON.parse(raw)); } catch {} }, [slug]);
  const [activePrintJobId, setActivePrintJobId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedReceiptOrder || !token) { setActivePrintJobId(null); return; }
    let cancelled = false;
    createPrintJob(slug, token, selectedReceiptOrder.id, selectedReceiptOrder.orderNumber, 'customer')
      .then(job => { if (!cancelled) setActivePrintJobId(job.id); })
      .catch(() => { /* a fila local continua funcionando como fallback */ });
    return () => { cancelled = true; };
  }, [selectedReceiptOrder?.id, slug, token]);
  const persistPrintJobState = async (state: 'pendente'|'imprimindo'|'impresso'|'erro') => {
    if (!activePrintJobId || !token) return;
    try { await updatePrintJob(slug, token, activePrintJobId, { status: state, attempts: state === 'imprimindo' ? 1 : undefined }); } catch {}
  };

  
  // Modal for add/edit dish
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);

  // Modal for add/edit delivery zone
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneFee, setZoneFee] = useState('');
  const [zoneEstTime, setZoneEstTime] = useState('30 - 45 min');

  // Modal for add/edit driver
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverInfo | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverVehicle, setDriverVehicle] = useState('Honda CG 160 Fan');
  const [driverPlate, setDriverPlate] = useState('');
  const [driverPhoto, setDriverPhoto] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80');
  const [driverPhotoUploading, setDriverPhotoUploading] = useState(false);
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverSaveError, setDriverSaveError] = useState<string | null>(null);

  // Order Dispatch Modal (assigning driver)
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  // Cancelamento de pedido com motivo obrigatório (fica registrado no
  // histórico do pedido — nunca cancela silenciosamente).
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Cancelamento em massa / cancelar todos (Fase 4, itens 24-26). Reaproveita
  // o mesmo onUpdateOrderStatus(...,'cancelado', motivo) usado no
  // cancelamento individual — sem endpoint novo, sem duplicar lógica.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [bulkCancelReasonInput, setBulkCancelReasonInput] = useState('');
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);
  const [cancelAllConfirmText, setCancelAllConfirmText] = useState('');
  const [cancelAllReasonInput, setCancelAllReasonInput] = useState('');
  const [showCancelledOrders, setShowCancelledOrders] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Dish Form State
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState(categories[0]?.id || 'burgers');
  const [dishDescription, setDishDescription] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishOriginalPrice, setDishOriginalPrice] = useState('');
  const [dishImage, setDishImage] = useState('');
  const [dishPrepTime, setDishPrepTime] = useState('20');
  const [dishServes, setDishServes] = useState('1');
  const [dishTags, setDishTags] = useState<DietaryTag[]>([]);
  // Trava o botão de Salvar enquanto a foto do prato ainda está subindo —
  // sem isso, salvar durante o upload gravava a foto ANTIGA (a nova só
  // chegava depois e ficava perdida, sem nenhum aviso).
  const [dishImageUploading, setDishImageUploading] = useState(false);
  const [dishSaving, setDishSaving] = useState(false);
  const [dishSaveError, setDishSaveError] = useState<string | null>(null);

  // Config Form State
  const [localConfig, setLocalConfig] = useState<RestaurantConfig>({ ...restaurantConfig });
  // Modal de prévia (celular/desktop) do layout escolhido pra este restaurante
  const [showLayoutPreview, setShowLayoutPreview] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Campos do formulário de Configurações que só salvam ao clicar em "Salvar
  // Alterações" (nome, telefone, taxas, etc.) ficam "sujos" (não salvos) até lá.
  // Avisa o AdminPortal disso pra ele poder confirmar antes de trocar de restaurante.
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(localConfig) !== JSON.stringify(restaurantConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfig, restaurantConfig]);

  // Se este painel for desmontado (ex: o admin trocou de restaurante) com
  // alterações pendentes, avisa que não há mais nada "sujo" nesta instância.
  useEffect(() => {
    return () => onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Financial Metrics Calculation
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((acc, o) => acc + o.total, 0);
  const validOrders = orders.filter((o) => o.status !== 'cancelado');
  const validOrdersCount = validOrders.length;
  const averageTicket = validOrdersCount > 0 ? totalRevenue / validOrdersCount : 0;
  const deliveryRevenue = validOrders.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);

  // Open Dish Edit Modal
  const handleOpenDishModal = (dish?: MenuItem) => {
    if (dish) {
      setEditingDish(dish);
      setDishName(dish.name);
      setDishCategory(dish.categoryId);
      setDishDescription(dish.description);
      setDishPrice(dish.price.toString());
      setDishOriginalPrice(dish.originalPrice ? dish.originalPrice.toString() : '');
      setDishImage(dish.image);
      setDishPrepTime(dish.preparationTimeMinutes ? dish.preparationTimeMinutes.toString() : '20');
      setDishServes(dish.servesCount ? dish.servesCount.toString() : '1');
      setDishTags(dish.tags || []);
    } else {
      setEditingDish(null);
      setDishName('');
      setDishCategory(categories[0]?.id || 'burgers');
      setDishDescription('');
      setDishPrice('');
      setDishOriginalPrice('');
      setDishImage('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80');
      setDishPrepTime('20');
      setDishServes('1');
      setDishTags(['destaque']);
    }
    setDishSaveError(null);
    setIsDishModalOpen(true);
  };

  const handleSaveDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim() || !dishPrice) return;
    if (dishImageUploading) return; // segunda trava — o botão já fica disabled, mas o form pode ser submetido via Enter

    const priceNum = parseFloat(dishPrice.replace(',', '.'));
    const origPriceNum = dishOriginalPrice ? parseFloat(dishOriginalPrice.replace(',', '.')) : undefined;

    setDishSaving(true);
    setDishSaveError(null);
    let ok = false;
    if (editingDish) {
      const updated: MenuItem = {
        ...editingDish,
        name: dishName.trim(),
        categoryId: dishCategory,
        description: dishDescription.trim(),
        price: priceNum,
        originalPrice: origPriceNum,
        image: dishImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        preparationTimeMinutes: parseInt(dishPrepTime) || 20,
        servesCount: parseInt(dishServes) || 1,
        tags: dishTags,
      };
      ok = await onUpdateMenuItem(updated);
    } else {
      const newDish: MenuItem = {
        id: `item-${Date.now()}`,
        name: dishName.trim(),
        categoryId: dishCategory,
        description: dishDescription.trim(),
        price: priceNum,
        originalPrice: origPriceNum,
        image: dishImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        available: true,
        preparationTimeMinutes: parseInt(dishPrepTime) || 20,
        servesCount: parseInt(dishServes) || 1,
        tags: dishTags,
      };
      ok = await onAddMenuItem(newDish);
    }
    setDishSaving(false);

    // Só fecha o modal se o servidor confirmou o salvamento — antes o modal
    // fechava sempre, mesmo quando o PUT falhava, e o admin via a janela
    // sumir como se tivesse dado certo. Agora, se falhar, o modal continua
    // aberto com o erro visível bem ao lado do botão (além do banner lá em
    // cima), pra ficar óbvio que precisa tentar de novo.
    if (ok) {
      playSoundEffect('success');
      setIsDishModalOpen(false);
    } else {
      setDishSaveError('Não foi possível salvar. Verifique sua conexão (ou se sua sessão expirou) e tente novamente.');
    }
  };

  // Zone CRUD
  const handleOpenZoneModal = (zone?: DeliveryZone) => {
    if (zone) {
      setEditingZone(zone);
      setZoneName(zone.neighborhood);
      setZoneFee(zone.fee.toString());
      setZoneEstTime(zone.estimatedMinutes);
    } else {
      setEditingZone(null);
      setZoneName('');
      setZoneFee('8.00');
      setZoneEstTime('30 - 45 min');
    }
    setIsZoneModalOpen(true);
  };

  const handleSaveZoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim() || !zoneFee) return;

    const feeNum = parseFloat(zoneFee.replace(',', '.'));
    const currentZones = localConfig.deliveryZones || [];

    let updatedZones: DeliveryZone[];
    if (editingZone) {
      updatedZones = currentZones.map((z) =>
        z.id === editingZone.id
          ? { ...z, neighborhood: zoneName.trim(), fee: feeNum, estimatedMinutes: zoneEstTime.trim() }
          : z
      );
    } else {
      const newZone: DeliveryZone = {
        id: `zone-${Date.now()}`,
        neighborhood: zoneName.trim(),
        fee: feeNum,
        estimatedMinutes: zoneEstTime.trim(),
        active: true,
      };
      updatedZones = [...currentZones, newZone];
    }

    const updatedConfig = { ...localConfig, deliveryZones: updatedZones };
    setLocalConfig(updatedConfig);
    onUpdateConfig(updatedConfig);
    setIsZoneModalOpen(false);
    playSoundEffect('success');
  };

  const handleDeleteZone = (id: string) => {
    const currentZones = localConfig.deliveryZones || [];
    const updatedZones = currentZones.filter((z) => z.id !== id);
    const updatedConfig = { ...localConfig, deliveryZones: updatedZones };
    setLocalConfig(updatedConfig);
    onUpdateConfig(updatedConfig);
    playSoundEffect('beep');
  };

  const handleToggleZoneActive = (id: string) => {
    const currentZones = localConfig.deliveryZones || [];
    const updatedZones = currentZones.map((z) =>
      z.id === id ? { ...z, active: !z.active } : z
    );
    const updatedConfig = { ...localConfig, deliveryZones: updatedZones };
    setLocalConfig(updatedConfig);
    onUpdateConfig(updatedConfig);
  };

  // Item pedido: "Bairros e taxas pode ser copiado de um restaurante para o
  // outro" — busca o config PÚBLICO (GET /api/:slug/menu, sem autenticação,
  // igual o cardápio do cliente carrega) de outro restaurante já cadastrado
  // e importa os bairros dele pra este. Gera IDs novos pra não colidir com
  // os já existentes aqui. Não apaga os bairros já cadastrados — soma.
  const [isCopyZonesOpen, setIsCopyZonesOpen] = useState(false);
  const [copyZonesSourceSlug, setCopyZonesSourceSlug] = useState('');
  const [copyZonesLoading, setCopyZonesLoading] = useState(false);
  const [copyZonesError, setCopyZonesError] = useState<string | null>(null);

  // ---------- Ajuste operacional em tempo real (Fase 4, itens 14-16) ----------
  const [showOperationalPanel, setShowOperationalPanel] = useState(false);
  const [opReason, setOpReason] = useState('');
  const currentOpStatus = localConfig.operationalStatus || 'normal';
  const currentOpAdjustment = localConfig.operationalAdjustmentMinutes || 0;

  const applyOperationalAdjustment = (status: 'normal' | 'busy' | 'delayed', minutes: number) => {
    const previousMinutes = currentOpAdjustment;
    if (previousMinutes === minutes && currentOpStatus === status) return;
    const entry = {
      id: `adj-${Date.now()}`,
      timestamp: new Date().toISOString(),
      previousMinutes,
      newMinutes: minutes,
      status,
      reason: opReason.trim() || undefined,
    };
    // Histórico capado em 50 entradas (mais recente primeiro) — não cresce
    // pra sempre, mas guarda um bom retrospecto de operação (item 16).
    const history = [entry, ...(localConfig.operationalAdjustmentHistory || [])].slice(0, 50);
    const updated = {
      ...localConfig,
      operationalStatus: status,
      operationalAdjustmentMinutes: minutes,
      operationalAdjustmentHistory: history,
    };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    setOpReason('');
    playSoundEffect('beep');
  };

  // ---------- Motor de cálculo de entrega (Fase 4, itens 9-13) ----------
  const [showDeliveryEngine, setShowDeliveryEngine] = useState(false);
  const [locCepLoading, setLocCepLoading] = useState(false);
  const [locCepError, setLocCepError] = useState<string | null>(null);
  const [editingCepRangeId, setEditingCepRangeId] = useState<string | 'new' | null>(null);
  const [cepDraft, setCepDraft] = useState({ cepStart: '', cepEnd: '', fee: '', estimatedMinutes: '' });
  const [editingTierId, setEditingTierId] = useState<string | 'new' | null>(null);
  const [tierDraft, setTierDraft] = useState({ fromKm: '', toKm: '', fee: '', prepMinutes: '', deliveryMinutes: '' });

  const updateConfigField = <K extends keyof RestaurantConfig>(key: K, value: RestaurantConfig[K]) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  const restaurantLocation = localConfig.restaurantLocation || {};
  const updateLocation = (patch: Partial<NonNullable<RestaurantConfig['restaurantLocation']>>) => {
    updateConfigField('restaurantLocation', { ...restaurantLocation, ...patch });
  };

  // CEP automático da localização do restaurante (mesmo padrão ViaCEP+Nominatim
  // já usado no endereço do cliente — item 8/9) — preenche rua/bairro/cidade/
  // estado e tenta geocodificar lat/lng, tudo pro cálculo por distância funcionar.
  const handleLocationCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setLocCepError('O CEP deve conter 8 dígitos');
      return;
    }
    setLocCepLoading(true);
    setLocCepError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setLocCepError('CEP não encontrado.');
        return;
      }
      updateLocation({
        cep: cleanCep,
        street: data.logradouro || restaurantLocation.street,
        neighborhood: data.bairro || restaurantLocation.neighborhood,
        city: data.localidade || restaurantLocation.city,
        state: data.uf || restaurantLocation.state,
      });
      try {
        const q = encodeURIComponent(`${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || ''}, ${data.uf || ''}, Brasil`);
        const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`);
        const geoResults = await geo.json();
        if (Array.isArray(geoResults) && geoResults[0]) {
          updateLocation({ lat: parseFloat(geoResults[0].lat), lng: parseFloat(geoResults[0].lon) });
        }
      } catch {
        // best-effort — sem lat/lng, os métodos por distância/fórmula só não vão funcionar até isso ser preenchido
      }
      playSoundEffect('beep');
    } catch {
      setLocCepError('Erro ao consultar CEP.');
    } finally {
      setLocCepLoading(false);
    }
  };

  const cepRanges = localConfig.cepRanges || [];
  const saveCepRangeForm = () => {
    const fee = parseFloat(cepDraft.fee.replace(',', '.'));
    const startDigits = cepDraft.cepStart.replace(/\D/g, '');
    const endDigits = cepDraft.cepEnd.replace(/\D/g, '');
    if (startDigits.length !== 8 || endDigits.length !== 8 || isNaN(fee)) return;
    if (editingCepRangeId === 'new') {
      const newRange = { id: `cep-${Date.now()}`, cepStart: startDigits, cepEnd: endDigits, fee, estimatedMinutes: cepDraft.estimatedMinutes.trim() || undefined, active: true };
      updateConfigField('cepRanges', [...cepRanges, newRange]);
    } else if (editingCepRangeId) {
      updateConfigField('cepRanges', cepRanges.map((r) => (r.id === editingCepRangeId ? { ...r, cepStart: startDigits, cepEnd: endDigits, fee, estimatedMinutes: cepDraft.estimatedMinutes.trim() || undefined } : r)));
    }
    setEditingCepRangeId(null);
  };
  const openCepRangeForm = (r?: typeof cepRanges[number]) => {
    if (r) {
      setEditingCepRangeId(r.id);
      setCepDraft({ cepStart: r.cepStart, cepEnd: r.cepEnd, fee: String(r.fee), estimatedMinutes: r.estimatedMinutes || '' });
    } else {
      setEditingCepRangeId('new');
      setCepDraft({ cepStart: '', cepEnd: '', fee: '', estimatedMinutes: '' });
    }
  };
  const deleteCepRange = (id: string) => {
    if (!confirm('Excluir essa faixa de CEP?')) return;
    updateConfigField('cepRanges', cepRanges.filter((r) => r.id !== id));
  };
  const toggleCepRangeActive = (id: string) => {
    updateConfigField('cepRanges', cepRanges.map((r) => (r.id === id ? { ...r, active: r.active === false } : r)));
  };

  const distanceTiers = localConfig.distanceTiers || [];
  const saveTierForm = () => {
    const fromKm = parseFloat(tierDraft.fromKm.replace(',', '.'));
    const toKm = parseFloat(tierDraft.toKm.replace(',', '.'));
    const fee = parseFloat(tierDraft.fee.replace(',', '.'));
    if (isNaN(fromKm) || isNaN(toKm) || isNaN(fee)) return;
    const prepMinutes = tierDraft.prepMinutes ? parseInt(tierDraft.prepMinutes, 10) : undefined;
    const deliveryMinutes = tierDraft.deliveryMinutes ? parseInt(tierDraft.deliveryMinutes, 10) : undefined;
    if (editingTierId === 'new') {
      const newTier = { id: `tier-${Date.now()}`, fromKm, toKm, fee, prepMinutes, deliveryMinutes, active: true };
      updateConfigField('distanceTiers', [...distanceTiers, newTier].sort((a, b) => a.fromKm - b.fromKm));
    } else if (editingTierId) {
      updateConfigField('distanceTiers', distanceTiers.map((t) => (t.id === editingTierId ? { ...t, fromKm, toKm, fee, prepMinutes, deliveryMinutes } : t)).sort((a, b) => a.fromKm - b.fromKm));
    }
    setEditingTierId(null);
  };
  const openTierForm = (t?: typeof distanceTiers[number]) => {
    if (t) {
      setEditingTierId(t.id);
      setTierDraft({ fromKm: String(t.fromKm), toKm: String(t.toKm), fee: String(t.fee), prepMinutes: t.prepMinutes != null ? String(t.prepMinutes) : '', deliveryMinutes: t.deliveryMinutes != null ? String(t.deliveryMinutes) : '' });
    } else {
      setEditingTierId('new');
      setTierDraft({ fromKm: '', toKm: '', fee: '', prepMinutes: '', deliveryMinutes: '' });
    }
  };
  const deleteTier = (id: string) => {
    if (!confirm('Excluir essa faixa de distância?')) return;
    updateConfigField('distanceTiers', distanceTiers.filter((t) => t.id !== id));
  };
  const toggleTierActive = (id: string) => {
    updateConfigField('distanceTiers', distanceTiers.map((t) => (t.id === id ? { ...t, active: t.active === false } : t)));
  };

  const HYBRID_METHOD_LABELS: Record<string, string> = { neighborhood: 'Bairro', cep: 'CEP', distance: 'Distância' };
  const hybridPriority = (localConfig.deliveryHybridPriority || ['cep', 'neighborhood', 'distance']).filter((m) => m !== 'hybrid' && m !== 'formula');
  const moveHybridPriority = (method: string, dir: -1 | 1) => {
    const idx = hybridPriority.indexOf(method as any);
    const targetIdx = idx + dir;
    if (idx === -1 || targetIdx < 0 || targetIdx >= hybridPriority.length) return;
    const next = [...hybridPriority];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    updateConfigField('deliveryHybridPriority', next as any);
  };

  const handleCopyZonesFromRestaurant = async () => {
    if (!copyZonesSourceSlug) return;
    setCopyZonesLoading(true);
    setCopyZonesError(null);
    try {
      const data = await fetchMenu(copyZonesSourceSlug);
      const sourceZones = data.restaurantConfig.deliveryZones || [];
      if (sourceZones.length === 0) {
        setCopyZonesError('Esse restaurante ainda não tem bairros cadastrados.');
        return;
      }
      const currentZones = localConfig.deliveryZones || [];
      const importedZones: DeliveryZone[] = sourceZones.map((z, idx) => ({
        ...z,
        id: `zone-${Date.now()}-${idx}`,
      }));
      const updatedConfig = { ...localConfig, deliveryZones: [...currentZones, ...importedZones] };
      setLocalConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setIsCopyZonesOpen(false);
      setCopyZonesSourceSlug('');
      playSoundEffect('success');
    } catch (err) {
      setCopyZonesError('Não foi possível carregar os bairros desse restaurante.');
    } finally {
      setCopyZonesLoading(false);
    }
  };

  // Driver CRUD
  const handleOpenDriverModal = (driver?: DriverInfo) => {
    if (driver) {
      setEditingDriver(driver);
      setDriverName(driver.name);
      setDriverPhone(driver.phone);
      setDriverVehicle(driver.vehicle);
      setDriverPlate(driver.plate || '');
      setDriverPhoto(driver.photo || '');
    } else {
      setEditingDriver(null);
      setDriverName('');
      setDriverPhone('(11) 9');
      setDriverVehicle('Honda CG 160 Fan');
      setDriverPlate('BRA2E19');
      setDriverPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80');
    }
    setIsDriverModalOpen(true);
  };

  const handleSaveDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;
    if (driverPhotoUploading) return; // ver comentário equivalente em handleSaveDishSubmit

    const currentDrivers = localConfig.drivers || [];
    let updatedDrivers: DriverInfo[];

    if (editingDriver) {
      updatedDrivers = currentDrivers.map((d) =>
        d.id === editingDriver.id
          ? {
              ...d,
              name: driverName.trim(),
              phone: driverPhone.trim(),
              vehicle: driverVehicle.trim(),
              plate: driverPlate.trim(),
              photo: driverPhoto.trim(),
            }
          : d
      );
    } else {
      const newDriver: DriverInfo = {
        id: `driver-${Date.now()}`,
        name: driverName.trim(),
        phone: driverPhone.trim(),
        vehicle: driverVehicle.trim(),
        plate: driverPlate.trim(),
        photo: driverPhoto.trim(),
        status: 'available',
        rating: 5.0,
      };
      updatedDrivers = [...currentDrivers, newDriver];
    }

    const updatedConfig = { ...localConfig, drivers: updatedDrivers };
    setLocalConfig(updatedConfig);
    setDriverSaving(true);
    setDriverSaveError(null);
    const ok = await onUpdateConfig(updatedConfig);
    setDriverSaving(false);
    // Mesma correção do formulário de prato: só fecha se o servidor confirmou.
    if (ok) {
      setIsDriverModalOpen(false);
      playSoundEffect('success');
    } else {
      setDriverSaveError('Não foi possível salvar. Verifique sua conexão (ou se sua sessão expirou) e tente novamente.');
    }
  };

  const handleDeleteDriver = (id: string) => {
    const currentDrivers = localConfig.drivers || [];
    const updatedDrivers = currentDrivers.filter((d) => d.id !== id);
    const updatedConfig = { ...localConfig, drivers: updatedDrivers };
    setLocalConfig(updatedConfig);
    onUpdateConfig(updatedConfig);
    playSoundEffect('beep');
  };

  const handleToggleDriverStatus = (id: string) => {
    const currentDrivers = localConfig.drivers || [];
    const updatedDrivers = currentDrivers.map((d) => {
      if (d.id === id) {
        const nextStatus = d.status === 'available' ? 'busy' : d.status === 'busy' ? 'offline' : 'available';
        return { ...d, status: nextStatus as 'available' | 'busy' | 'offline' };
      }
      return d;
    });
    const updatedConfig = { ...localConfig, drivers: updatedDrivers };
    setLocalConfig(updatedConfig);
    onUpdateConfig(updatedConfig);
    playSoundEffect('beep');
  };

  // Item pedido: "entregadores pode ser copiado de outro restaurante" — mesma
  // lógica da cópia de bairros, mas pra frota de motoboys.
  const [isCopyDriversOpen, setIsCopyDriversOpen] = useState(false);
  const [copyDriversSourceSlug, setCopyDriversSourceSlug] = useState('');
  const [copyDriversLoading, setCopyDriversLoading] = useState(false);
  const [copyDriversError, setCopyDriversError] = useState<string | null>(null);

  const handleCopyDriversFromRestaurant = async () => {
    if (!copyDriversSourceSlug) return;
    setCopyDriversLoading(true);
    setCopyDriversError(null);
    try {
      const data = await fetchMenu(copyDriversSourceSlug);
      const sourceDrivers = data.restaurantConfig.drivers || [];
      if (sourceDrivers.length === 0) {
        setCopyDriversError('Esse restaurante ainda não tem entregadores cadastrados.');
        return;
      }
      const currentDrivers = localConfig.drivers || [];
      const importedDrivers: DriverInfo[] = sourceDrivers.map((d, idx) => ({
        ...d,
        id: `driver-${Date.now()}-${idx}`,
        status: 'offline' as const,
      }));
      const updatedConfig = { ...localConfig, drivers: [...currentDrivers, ...importedDrivers] };
      setLocalConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setIsCopyDriversOpen(false);
      setCopyDriversSourceSlug('');
      playSoundEffect('success');
    } catch (err) {
      setCopyDriversError('Não foi possível carregar os entregadores desse restaurante.');
    } finally {
      setCopyDriversLoading(false);
    }
  };

  // Item pedido: banner de promoções configurável — adiciona/remove/edita
  // badges (título, subtítulo, ícone, cupom opcional), sem nenhum texto fixo.
  const handleAddPromoBadge = () => {
    const newBadge: PromoBadge = {
      id: `promo-${Date.now()}`,
      icon: '🎉',
      title: 'Nova promoção',
      subtitle: '',
    };
    const updated = { ...localConfig, promoBadges: [...(localConfig.promoBadges || []), newBadge] };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  const handleUpdatePromoBadge = (id: string, patch: Partial<PromoBadge>) => {
    const updated = {
      ...localConfig,
      promoBadges: (localConfig.promoBadges || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  const handleDeletePromoBadge = (id: string) => {
    const updated = { ...localConfig, promoBadges: (localConfig.promoBadges || []).filter((b) => b.id !== id) };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    playSoundEffect('beep');
  };

  // Biblioteca de badges/etiquetas de pratos (Fase 4, itens 5/6) — totalmente
  // editável por restaurante, nunca compartilhada com outro restaurante.
  // Sem nenhum badge cadastrado aqui, o sistema usa DEFAULT_BADGES (8
  // padrões) como se nada tivesse mudado — ver getBadgeInfo() em helpers.ts.
  const effectiveBadges = localConfig.badges && localConfig.badges.length > 0 ? localConfig.badges : DEFAULT_BADGES;

  const handleAddBadge = () => {
    const newBadge: RestaurantBadge = {
      id: `badge-${Date.now()}`,
      label: 'Novo badge',
      emoji: '🏷️',
      color: '#f59e0b',
      active: true,
    };
    // Na primeira personalização, parte da biblioteca padrão (não de uma
    // lista vazia) — assim o restaurante não perde os badges que já via.
    const base = localConfig.badges && localConfig.badges.length > 0 ? localConfig.badges : DEFAULT_BADGES;
    const updated = { ...localConfig, badges: [...base, newBadge] };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  const handleUpdateBadge = (id: string, patch: Partial<RestaurantBadge>) => {
    const base = localConfig.badges && localConfig.badges.length > 0 ? localConfig.badges : DEFAULT_BADGES;
    const updated = { ...localConfig, badges: base.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  const handleDeleteBadge = (id: string) => {
    const inUse = menuItems.filter((i) => i.tags?.includes(id)).length;
    if (inUse > 0 && !confirm(`${inUse} prato(s) usam este badge. Excluir mesmo assim? Os pratos deixam de mostrá-lo, mas nada mais é afetado.`)) {
      return;
    }
    const base = localConfig.badges && localConfig.badges.length > 0 ? localConfig.badges : DEFAULT_BADGES;
    const updated = { ...localConfig, badges: base.filter((b) => b.id !== id) };
    setLocalConfig(updated);
    onUpdateConfig(updated);
    playSoundEffect('beep');
  };

  const moveBadge = (id: string, direction: -1 | 1) => {
    const base = localConfig.badges && localConfig.badges.length > 0 ? localConfig.badges : DEFAULT_BADGES;
    const idx = base.findIndex((b) => b.id === id);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= base.length) return;
    const next = [...base];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    const updated = { ...localConfig, badges: next };
    setLocalConfig(updated);
    onUpdateConfig(updated);
  };

  // Dispatch Order with Driver
  const handleStartDispatch = (order: Order) => {
    setDispatchOrder(order);
    const availableDrivers = (localConfig.drivers || []).filter((d) => d.status === 'available');
    setSelectedDriverId(availableDrivers[0]?.id || localConfig.drivers?.[0]?.id || '');
  };

  const CANCEL_REASON_SUGGESTIONS = [
    'Cliente desistiu do pedido',
    'Endereço fora da área de entrega',
    'Item indisponível no momento',
    'Pedido duplicado',
    'Não foi possível contatar o cliente',
  ];

  const handleConfirmCancel = () => {
    if (!cancelOrderTarget || !cancelReasonInput.trim()) return;
    onUpdateOrderStatus(cancelOrderTarget.id, 'cancelado', undefined, cancelReasonInput.trim());
    setCancelOrderTarget(null);
    setCancelReasonInput('');
    playSoundEffect('beep');
  };

  // Pedidos "atualmente elegíveis" pra cancelamento em massa/cancelar todos —
  // nunca inclui os que já estão cancelados ou já entregues (item 25).
  const cancellableOrders = orders.filter((o) => o.status !== 'cancelado' && o.status !== 'entregue');
  const cancelledOrdersList = orders.filter((o) => o.status === 'cancelado');

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleConfirmBulkCancel = () => {
    if (!bulkCancelReasonInput.trim() || selectedOrderIds.size === 0) return;
    selectedOrderIds.forEach((id) => {
      onUpdateOrderStatus(id, 'cancelado', undefined, bulkCancelReasonInput.trim());
    });
    setShowBulkCancelModal(false);
    setBulkCancelReasonInput('');
    setSelectedOrderIds(new Set());
    setSelectionMode(false);
    playSoundEffect('beep');
  };

  const handleConfirmCancelAll = () => {
    if (cancelAllConfirmText.trim().toUpperCase() !== 'CANCELAR' || !cancelAllReasonInput.trim()) return;
    cancellableOrders.forEach((order) => {
      onUpdateOrderStatus(order.id, 'cancelado', undefined, cancelAllReasonInput.trim());
    });
    setShowCancelAllModal(false);
    setCancelAllConfirmText('');
    setCancelAllReasonInput('');
    playSoundEffect('beep');
  };

  const handleConfirmDispatch = () => {
    if (!dispatchOrder) return;
    const chosenDriver = (localConfig.drivers || []).find((d) => d.id === selectedDriverId);
    onUpdateOrderStatus(dispatchOrder.id, 'saiu_entrega', chosenDriver);
    setDispatchOrder(null);
    playSoundEffect('success');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(localConfig);
    setConfigSaved(true);
    playSoundEffect('success');
    setTimeout(() => setConfigSaved(false), 2500);
  };

  // Filter orders by Kanban column
  const pendingOrders = orders.filter((o) => o.status === 'recebido');
  const preparingOrders = orders.filter((o) => o.status === 'em_preparo');
  const transitOrders = orders.filter((o) => o.status === 'saiu_entrega' || o.status === 'pronto');
  const finishedOrders = orders.filter((o) => o.status === 'entregue');

  return (
    <div className="bg-stone-100 min-h-screen pb-16">
      {/* Top Admin Header */}
      <header className="bg-stone-900 text-white border-b border-stone-800 sticky top-11 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Painel do Restaurante & Delivery
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Operação Ativa
                </span>
              </h1>
              <p className="text-xs text-stone-400 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 bg-stone-800 text-amber-400 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide">
                  Restaurante Ativo
                </span>
                <span className="font-semibold text-stone-200">{restaurantConfig.name}</span>
                <span className="text-stone-500">· slug: {slug}</span>
                <span className="text-stone-500">· {validOrdersCount} pedidos registrados</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              id="admin-sound-toggle-btn"
              onClick={() => {
                unlockOrderAlertAudio(); // toque = gesto do usuário, aproveita pra destravar áudio no iOS
                onToggleSound();
                if (!soundEnabled) playOrderAlertSound(selectedAlertSoundId);
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                soundEnabled
                  ? 'bg-stone-800 text-amber-400 border-amber-500/30'
                  : 'bg-stone-800 text-stone-500 border-stone-700'
              }`}
              title={soundEnabled ? 'Alertas sonoros ativados' : 'Alertas sonoros desativados'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Som Ativado' : 'Sem Som'}</span>
            </button>

            <button
              id="admin-sound-picker-btn"
              onClick={() => setShowSoundPicker((v) => !v)}
              className="p-2 rounded-xl border border-stone-700 bg-stone-800 text-stone-300 hover:text-amber-400 text-xs font-semibold"
              title="Escolher som de alerta de pedido novo"
            >
              <Music className="w-4 h-4" />
            </button>

            {showSoundPicker && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl border border-stone-200 shadow-xl p-3 z-50 text-stone-900">
                <p className="text-xs font-bold text-stone-800 mb-0.5">Som de pedido novo</p>
                <p className="text-[11px] text-stone-500 mb-2">
                  Toca automaticamente quando um pedido novo chega, em qualquer aparelho (celular ou PC) com o painel aberto.
                </p>
                <div className="space-y-1">
                  {ORDER_ALERT_SOUNDS.map((sound) => (
                    <div
                      key={sound.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border ${
                        selectedAlertSoundId === sound.id ? 'border-amber-400 bg-amber-50' : 'border-stone-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedAlertSoundId(sound.id);
                          setSelectedOrderAlertSoundId(sound.id);
                        }}
                        className="flex-1 text-left text-xs font-semibold"
                      >
                        {sound.label}
                      </button>
                      <button
                        onClick={() => {
                          unlockOrderAlertAudio();
                          playOrderAlertSound(sound.id);
                        }}
                        className="px-2 py-1 rounded-lg bg-stone-900 text-white text-[10px] font-bold hover:bg-stone-700"
                        title="Testar este som"
                      >
                        ▶ Testar
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowSoundPicker(false)}
                  className="w-full mt-2 py-1.5 text-[11px] font-bold text-stone-500 hover:text-stone-800"
                >
                  Fechar
                </button>
              </div>
            )}

            <button
              id="admin-return-menu-btn"
              onClick={onCloseAdmin}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Eye className="w-4 h-4" />
              <span>Ver App do Cliente</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-3 overflow-x-auto scrollbar-none pt-1">
          <button
            id="tab-admin-orders"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Kanban de Pedidos</span>
            {pendingOrders.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            id="tab-admin-menu"
            onClick={() => setActiveTab('menu')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'menu'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Cardápio ({menuItems.length})</span>
          </button>

          <button
            id="tab-admin-identity"
            onClick={() => setActiveTab('identity')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'identity'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Dados do Restaurante</span>
          </button>

          <button
            id="tab-admin-zones"
            onClick={() => setActiveTab('zones')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'zones'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Bairros & Taxas ({localConfig.deliveryZones?.length || 0})</span>
          </button>

          <button
            id="tab-admin-drivers"
            onClick={() => setActiveTab('drivers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'drivers'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Entregadores ({localConfig.drivers?.length || 0})</span>
          </button>

          <button
            id="tab-admin-config"
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Aparência</span>
          </button>

          <button
            id="tab-admin-metrics"
            onClick={() => setActiveTab('metrics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Faturamento & Métricas</span>
          </button>

          <button
            id="tab-admin-tools"
            onClick={() => setActiveTab('tools')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'tools'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Ferramentas & CMV</span>
          </button>

          <button
            id="tab-admin-notifications"
            onClick={() => setActiveTab('notifications')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notificações</span>
          </button>

          <button
            id="tab-admin-ai"
            onClick={() => setActiveTab('ai')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <span>🤖</span>
            <span>IA</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* ========================================================================= */}
        {/* TAB 1: KANBAN LIVE ORDERS & DELIVERY DISPATCH */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
                  <span>Kanban de Pedidos Delivery</span>
                  <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                    {orders.length} pedidos hoje
                  </span>
                </h2>
                <p className="text-xs text-stone-500">
                  Gerencie todo o fluxo desde a chegada até a entrega com motoboy
                </p>
              </div>
              <button
                id="test-sound-bell-btn"
                onClick={() => playSoundEffect('bell')}
                className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 flex items-center gap-1 shadow-2xs"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Testar Sinal Sonoro</span>
              </button>
            </div>

            {/* Cancelamento em massa / cancelar todos / ver cancelados (Fase 4, itens 24-26) */}
            <div className="flex flex-wrap items-center gap-2 -mt-1">
              <button
                onClick={() => {
                  setSelectionMode((v) => !v);
                  setSelectedOrderIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                  selectionMode
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {selectionMode ? 'Cancelar seleção' : 'Selecionar pedidos'}
              </button>

              {selectionMode && (
                <>
                  <span className="text-xs text-stone-500">{selectedOrderIds.size} selecionado(s)</span>
                  <button
                    onClick={() => setSelectedOrderIds(new Set(cancellableOrders.map((o) => o.id)))}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-stone-600 hover:bg-stone-100"
                  >
                    Selecionar todos elegíveis
                  </button>
                  <button
                    disabled={selectedOrderIds.size === 0}
                    onClick={() => setShowBulkCancelModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold"
                  >
                    Cancelar selecionados ({selectedOrderIds.size})
                  </button>
                </>
              )}

              <button
                onClick={() => setShowCancelledOrders((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                  showCancelledOrders
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
                }`}
              >
                ❌ Cancelados ({cancelledOrdersList.length})
              </button>

              {cancellableOrders.length > 0 && (
                <button
                  onClick={() => setShowCancelAllModal(true)}
                  className="ml-auto px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold"
                >
                  ⚠️ Cancelar todos ({cancellableOrders.length})
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={async()=>{const n=orders.filter(o=>['entregue','cancelado'].includes(o.status)).length;if(!n)return alert('Não há histórico finalizado para excluir.');if(!window.confirm(`Excluir ${n} pedido(s) finalizado(s)/cancelado(s) deste restaurante? Esta ação não pode ser desfeita.`))return;if(onClearOrderHistory)await onClearOrderHistory();}} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5"/> Limpar histórico ({orders.filter(o=>['entregue','cancelado'].includes(o.status)).length})</button>
              <button onClick={async()=>{const url=`${window.location.origin}/r/${toPublicSlug(localConfig.name || slug)}`;try{await navigator.clipboard.writeText(url);alert(`Link exclusivo copiado:
${url}`)}catch{window.prompt('Copie o link exclusivo deste restaurante:',url)}}} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5"/> Copiar link exclusivo</button>
            </div>

            {/* ❌ Cancelados — nunca some do sistema, só sai das colunas ativas (item 26) */}
            {showCancelledOrders && (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-2">
                <h3 className="font-extrabold text-stone-800 text-sm mb-1">Pedidos cancelados</h3>
                {cancelledOrdersList.length === 0 ? (
                  <p className="text-xs text-stone-400">Nenhum pedido cancelado até agora.</p>
                ) : (
                  cancelledOrdersList.map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs border border-stone-100 rounded-xl p-2.5 bg-stone-50"
                    >
                      <span className="font-bold text-stone-800">
                        #{order.orderNumber} · {order.customer.name} · {formatCurrency(order.total)}
                      </span>
                      <span className="text-stone-500 italic">
                        Motivo: {order.cancelReason || 'não informado'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 4-Column Kanban Board */}
            <div className="admin-kanban grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Column 1: Novos Pedidos */}
              <div className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200 flex flex-col h-full min-h-[440px]">
                <div className="flex items-center justify-between pb-2.5 border-b border-amber-200 mb-3">
                  <h3 className="font-extrabold text-amber-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    Novos Pedidos
                  </h3>
                  <span className="bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingOrders.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {pendingOrders.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Nenhum novo pedido pendente</p>
                    </div>
                  ) : (
                    pendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white p-3.5 rounded-2xl border border-amber-300 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {selectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                                className="mt-0.5 accent-rose-600"
                              />
                            )}
                            <div>
                              <span className="text-xs font-black text-amber-700">#{order.orderNumber}</span>
                              <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                                {order.customer.name}
                              </h4>
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-black">
                            🛵 Delivery
                          </span>
                        </div>

                        {order.customer.address && (
                          <div className="bg-stone-50 p-2 rounded-xl border border-stone-100 text-[11px] text-stone-600 space-y-0.5">
                            <p className="font-semibold text-stone-900 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-600" />
                              {order.customer.address.street}, {order.customer.address.number}
                              {order.customer.address.unit && ` — ${order.customer.address.unit}`}
                            </p>
                            <p className="text-stone-500">
                              {order.customer.address.neighborhood} • {order.customer.address.city}
                            </p>
                            {order.customer.address.complement && (
                              <p className="text-stone-400 italic">Comp: {order.customer.address.complement}</p>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-stone-700 bg-stone-50 p-2 rounded-xl space-y-1">
                          {order.items.map((i) => (
                            <div key={i.id} className="flex justify-between">
                              <span>{i.quantity}x {i.menuItem.name}</span>
                              <span className="font-bold">{formatCurrency(i.totalPrice)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                          <span className="text-stone-500 font-medium">Total:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-stone-900">{formatCurrency(order.total)}</span>
                            <button
                              onClick={() => setSelectedReceiptOrder(order)}
                              className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                              title="Imprimir Comanda Térmica"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'em_preparo')}
                            className="py-2 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs text-center flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>Aceitar & Cozinhar</span>
                          </button>
                          <button
                            onClick={() => setCancelOrderTarget(order)}
                            className="py-2 px-2 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600 rounded-xl font-bold text-xs text-center"
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Em Cozinha / Preparo */}
              <div className="bg-blue-50/70 rounded-2xl p-3 border border-blue-200 flex flex-col h-full min-h-[440px]">
                <div className="flex items-center justify-between pb-2.5 border-b border-blue-200 mb-3">
                  <h3 className="font-extrabold text-blue-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <ChefHat className="w-4 h-4 text-blue-600" />
                    Em Preparo
                  </h3>
                  <span className="bg-blue-200 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {preparingOrders.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {preparingOrders.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Nenhum pedido na chapa</p>
                    </div>
                  ) : (
                    preparingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white p-3.5 rounded-2xl border border-blue-300 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {selectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                                className="mt-0.5 accent-rose-600"
                              />
                            )}
                            <div>
                              <span className="text-xs font-black text-blue-700">#{order.orderNumber}</span>
                              <h4 className="font-bold text-stone-900 text-xs">{order.customer.name}</h4>
                            </div>
                          </div>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                            🛵 {order.customer.address?.neighborhood || 'Delivery'}
                          </span>
                        </div>

                        <div className="text-xs text-stone-700 bg-stone-50 p-2 rounded-xl space-y-1">
                          {order.items.map((i) => (
                            <div key={i.id} className="text-xs">
                              <span className="font-bold text-stone-900">{i.quantity}x {i.menuItem.name}</span>
                              {i.selectedChoices.length > 0 && (
                                <p className="text-[10px] text-stone-500">
                                  {i.selectedChoices.map((c) => c.optionName).join(', ')}
                                </p>
                              )}
                              {i.specialNotes && (
                                <p className="text-[10px] text-amber-700 font-semibold italic">Obs: {i.specialNotes}</p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'pronto')}
                            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-4 h-4" />
                            <span>Marcar como PRONTO</span>
                          </button>
                          <button
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
                            title="Imprimir Comanda Térmica"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCancelOrderTarget(order)}
                            className="p-2.5 rounded-xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600"
                            title="Cancelar pedido"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 3: Saiu para Entrega / Em Trânsito */}
              <div className="bg-purple-50/70 rounded-2xl p-3 border border-purple-200 flex flex-col h-full min-h-[440px]">
                <div className="flex items-center justify-between pb-2.5 border-b border-purple-200 mb-3">
                  <h3 className="font-extrabold text-purple-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-purple-600 animate-pulse" />
                    Pronto / Em Trânsito / Entrega
                  </h3>
                  <span className="bg-purple-200 text-purple-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {transitOrders.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {transitOrders.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <Bike className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Nenhum motoboy na rua</p>
                    </div>
                  ) : (
                    transitOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white p-3.5 rounded-2xl border border-purple-300 shadow-xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {selectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                                className="mt-0.5 accent-rose-600"
                              />
                            )}
                            <div>
                              <span className="text-xs font-black text-purple-700">#{order.orderNumber}</span>
                              <h4 className="font-bold text-stone-900 text-xs">{order.customer.name}</h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-stone-900">
                              {formatCurrency(order.total)}
                            </span>
                            <button
                              onClick={() => setSelectedReceiptOrder(order)}
                              className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                              title="Imprimir Comanda"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {order.driver && (
                          <div className="bg-purple-50 p-2 rounded-xl border border-purple-100 flex items-center gap-2">
                            <img
                              src={order.driver.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                              alt={order.driver.name}
                              className="w-8 h-8 rounded-full object-cover border border-purple-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="text-[10px] leading-tight flex-1">
                              <p className="font-bold text-purple-950">Motoboy: {order.driver.name}</p>
                              <p className="text-purple-700">{order.driver.vehicle} • {order.driver.plate}</p>
                            </div>
                            <a
                              href={`https://wa.me/${order.driver.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-500 text-white"
                              title="WhatsApp do Motoboy"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {order.customer.address && (
                          <p className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded-lg">
                            📍 {order.customer.address.street}, {order.customer.address.number}
                            {order.customer.address.unit ? ` — ${order.customer.address.unit}` : ''} ({order.customer.address.neighborhood})
                          </p>
                        )}

                        {order.status === 'pronto' ? (
                          <button
                            onClick={() => handleStartDispatch(order)}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Bike className="w-4 h-4" />
                            <span>Despachar / Chamar Motoboy</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'entregue')}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirmar Entrega Concluída</span>
                          </button>
                        )}
                        <button
                          onClick={() => setCancelOrderTarget(order)}
                          className="w-full py-1.5 text-stone-400 hover:text-rose-700 rounded-xl font-bold text-[11px] text-center"
                        >
                          Cancelar pedido
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 4: Concluídos */}
              <div className="bg-emerald-50/70 rounded-2xl p-3 border border-emerald-200 flex flex-col h-full min-h-[440px]">
                <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200 mb-3">
                  <h3 className="font-extrabold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Entregues Hoje
                  </h3>
                  <span className="bg-emerald-200 text-emerald-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {finishedOrders.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {finishedOrders.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Nenhuma entrega finalizada hoje</p>
                    </div>
                  ) : (
                    finishedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-black text-stone-800">#{order.orderNumber}</span> - {order.customer.name}
                          <span className="text-[10px] text-stone-400 block">
                            {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {order.customer.address?.neighborhood}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-emerald-700">
                            {formatCurrency(order.total)}
                          </span>
                          <button
                            onClick={async () => { if (!window.confirm(`Excluir o pedido #${order.orderNumber} do histórico?`)) return; await onDeleteOrder?.(order.id); }}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700"
                            title="Excluir do histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                            title="Reimprimir Comanda"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MENU MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-stone-900">Gestão de Cardápio</h2>
                <p className="text-xs text-stone-500">
                  Adicione novos pratos, ajuste preços, tags e controle a disponibilidade
                </p>
              </div>
              <button
                id="add-new-dish-btn"
                onClick={() => handleOpenDishModal()}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Novo Prato</span>
              </button>
            </div>

            {/* ================= Categorias do Cardápio (Fase 4) ================= */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <button
                onClick={() => setShowCategoryPanel((v) => !v)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-stone-500" />
                  <span className="font-bold text-stone-900 text-sm">Categorias do Cardápio</span>
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                    {categories.length}
                  </span>
                </div>
                {showCategoryPanel ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>

              {showCategoryPanel && (
                <div className="border-t border-stone-200 p-4 space-y-2">
                  <p className="text-xs text-stone-500 -mt-1 mb-2">
                    Cada restaurante tem sua própria lista — organize do jeito que fizer sentido pro seu cardápio, sem categorias fixas.
                  </p>

                  {categories.map((cat, idx) => {
                    const productCount = menuItems.filter((i) => i.categoryId === cat.id).length;
                    const isEditingThis = editingCategoryId === cat.id;
                    return (
                      <div key={cat.id} className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className={`flex items-center gap-2 p-2.5 ${cat.active === false ? 'opacity-50' : ''}`}>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveCategory(cat.id, -1)}
                              disabled={idx === 0}
                              className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveCategory(cat.id, 1)}
                              disabled={idx === categories.length - 1}
                              className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {cat.image ? (
                            <img src={cat.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-stone-100 flex-shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 flex-shrink-0 text-xs">
                              {cat.icon || '—'}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-stone-900 text-sm truncate">{cat.name}</p>
                            <p className="text-[11px] text-stone-500">
                              {productCount} {productCount === 1 ? 'produto' : 'produtos'}
                              {cat.active === false && ' • oculta'}
                            </p>
                          </div>

                          <button
                            onClick={() => toggleCategoryActive(cat)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              cat.active === false
                                ? 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                            title={cat.active === false ? 'Categoria oculta — clique pra reativar' : 'Categoria ativa — clique pra ocultar'}
                          >
                            {cat.active === false ? 'Oculta' : 'Ativa'}
                          </button>
                          <button
                            onClick={() => openEditCategoryForm(cat)}
                            className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => requestDeleteCategory(cat)}
                            className="p-2 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isEditingThis && (
                          <div className="border-t border-stone-200 bg-stone-50 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={categoryDraftName}
                                onChange={(e) => setCategoryDraftName(e.target.value)}
                                placeholder="Nome da categoria"
                                className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <input
                                type="text"
                                value={categoryDraftIcon}
                                onChange={(e) => setCategoryDraftIcon(e.target.value)}
                                placeholder="Ícone/emoji (ex: 🍣)"
                                className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                            <ImageUploadField
                              slug={slug}
                              token={token}
                              label="Imagem da categoria (opcional)"
                              mediaKind="category"
                              entityType="menu_category"
                              entityId={editingCategoryId && editingCategoryId !== 'new' ? editingCategoryId : undefined}
                              value={categoryDraftImage}
                              onChange={setCategoryDraftImage}
                              onUploadingChange={setCategoryImageUploading}
                              aspect="wide"
                            />
                            <div className="flex justify-end items-center gap-2 pt-1 flex-wrap">
                              {categoryImageUploading && (
                                <span className="text-[11px] text-amber-600 font-semibold mr-auto">Enviando foto…</span>
                              )}
                              {!categoryImageUploading && categorySaveError && (
                                <span className="text-[11px] text-rose-600 font-semibold mr-auto">⚠️ {categorySaveError}</span>
                              )}
                              <button onClick={closeCategoryForm} className="px-3 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-800">
                                Cancelar
                              </button>
                              <button
                                onClick={saveCategoryForm}
                                disabled={!categoryDraftName.trim() || categoryImageUploading}
                                className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl disabled:opacity-40"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {editingCategoryId === 'new' ? (
                    <div className="border border-amber-300 rounded-xl bg-amber-50 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={categoryDraftName}
                          onChange={(e) => setCategoryDraftName(e.target.value)}
                          placeholder="Nome da categoria"
                          className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                          type="text"
                          value={categoryDraftIcon}
                          onChange={(e) => setCategoryDraftIcon(e.target.value)}
                          placeholder="Ícone/emoji (ex: 🍰)"
                          className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <ImageUploadField
                        slug={slug}
                        token={token}
                        label="Imagem da categoria (opcional)"
                        mediaKind="category"
                        entityType="menu_category"
                        entityId={editingCategoryId && editingCategoryId !== 'new' ? editingCategoryId : undefined}
                        value={categoryDraftImage}
                        onChange={setCategoryDraftImage}
                        onUploadingChange={setCategoryImageUploading}
                        aspect="wide"
                      />
                      <div className="flex justify-end items-center gap-2 pt-1">
                        {categoryImageUploading && (
                          <span className="text-[11px] text-amber-600 font-semibold mr-auto">Enviando foto…</span>
                        )}
                        <button onClick={closeCategoryForm} className="px-3 py-1.5 text-xs font-bold text-stone-500 hover:text-stone-800">
                          Cancelar
                        </button>
                        <button
                          onClick={saveCategoryForm}
                          disabled={!categoryDraftName.trim() || categoryImageUploading}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl disabled:opacity-40"
                        >
                          Criar categoria
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={openNewCategoryForm}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-600 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova categoria
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Menu Items Table */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                    <tr>
                      <th className="p-3.5">Prato / Imagem</th>
                      <th className="p-3.5">Categoria</th>
                      <th className="p-3.5">Preço</th>
                      <th className="p-3.5 text-center">Disponibilidade</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {menuItems.map((dish) => (
                      <tr key={dish.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={dish.image}
                              alt={dish.name}
                              className="w-12 h-12 rounded-xl object-cover bg-stone-100 flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h4 className="font-bold text-stone-900">{dish.name}</h4>
                              <p className="text-stone-500 text-xs line-clamp-1 max-w-xs sm:max-w-md">
                                {dish.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize">
                            {dish.categoryId}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-stone-900">
                          {formatCurrency(dish.price)}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            id={`toggle-avail-${dish.id}`}
                            onClick={() => onToggleAvailability(dish.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              dish.available
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {dish.available ? 'Disponível' : 'Esgotado'}
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`edit-dish-${dish.id}`}
                              onClick={() => handleOpenDishModal(dish)}
                              className="p-2 rounded-lg hover:bg-stone-200 text-stone-600 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              id={`delete-dish-${dish.id}`}
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir "${dish.name}"?`)) {
                                  onDeleteMenuItem(dish.id);
                                }
                              }}
                              className="p-2 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: DADOS DO RESTAURANTE (nome, contato, endereço, pedido mínimo, frete) */}
        {/* ========================================================================= */}
        {activeTab === 'identity' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h2 className="text-lg font-black text-stone-900">Dados do Restaurante</h2>
              <p className="text-xs text-stone-500">
                Nome, contato, endereço, pedido mínimo, frete grátis e horário — separado da
                Aparência pra você achar rápido o que precisa
              </p>
            </div>

            {configSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                <Check className="w-4 h-4" />
                <span>Configurações salvas com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Nome do Estabelecimento</label>
                  <input
                    type="text"
                    value={localConfig.name}
                    onChange={(e) => setLocalConfig({ ...localConfig, name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Slogan / Descrição Curta</label>
                  <input
                    type="text"
                    value={localConfig.tagline}
                    onChange={(e) => setLocalConfig({ ...localConfig, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Número do WhatsApp (com DDD)</label>
                  <input
                    type="text"
                    value={localConfig.whatsapp}
                    onChange={(e) => setLocalConfig({ ...localConfig, whatsapp: e.target.value })}
                    placeholder="5511987654321"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Endereço da Cozinha / Loja</label>
                  <input
                    type="text"
                    value={localConfig.address}
                    onChange={(e) => setLocalConfig({ ...localConfig, address: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Pedido Mínimo Delivery (R$)</label>
                  <input
                    type="number"
                    step="1"
                    value={localConfig.minimumOrder || 25}
                    onChange={(e) => setLocalConfig({ ...localConfig, minimumOrder: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-stone-700">Frete Grátis a partir de (R$)</span>
                    {/* Item pedido: botão pra desativar a promoção de frete grátis sem
                        precisar zerar/apagar o valor configurado */}
                    <button
                      type="button"
                      onClick={() =>
                        setLocalConfig({ ...localConfig, freeDeliveryEnabled: !(localConfig.freeDeliveryEnabled ?? true) })
                      }
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        (localConfig.freeDeliveryEnabled ?? true)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {(localConfig.freeDeliveryEnabled ?? true) ? 'Ativado' : 'Desativado'}
                    </button>
                  </label>
                  <input
                    type="number"
                    step="5"
                    disabled={!(localConfig.freeDeliveryEnabled ?? true)}
                    value={localConfig.freeDeliveryThreshold || 80}
                    onChange={(e) => setLocalConfig({ ...localConfig, freeDeliveryThreshold: parseFloat(e.target.value) || 80 })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Tempo Médio Estimado</label>
                  <input
                    type="text"
                    value={localConfig.estimatedDeliveryTime}
                    onChange={(e) => setLocalConfig({ ...localConfig, estimatedDeliveryTime: e.target.value })}
                    placeholder="30 - 45 min"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Chave Pix para Recebimentos</label>
                  <input
                    type="text"
                    value={localConfig.pixKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, pixKey: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Horário de Funcionamento</label>
                  <input
                    type="text"
                    value={localConfig.openingHours}
                    onChange={(e) => setLocalConfig({ ...localConfig, openingHours: e.target.value })}
                    placeholder="Ter a Dom: 11:30 às 23:30"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.isOpen}
                    onChange={(e) => setLocalConfig({ ...localConfig, isOpen: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-bold text-stone-800">
                    Restaurante Aberto para Pedidos Delivery no Momento
                  </span>
                </label>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>

            {/* Item pedido: banner de promoções configurável — substitui o
                texto fixo "Entrega Rápida..." + cupom BEMVINDO10 que ficava
                hardcoded acima do cardápio. Sem nenhuma promoção cadastrada
                aqui, o banner simplesmente não aparece pro cliente. */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4" />
                    Banner de Promoções
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Aparece acima do cardápio pro cliente. Sem nenhuma promoção aqui, o banner
                    fica oculto — nada de texto fixo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPromoBadge}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar promoção</span>
                </button>
              </div>

              {(localConfig.promoBadges || []).length === 0 ? (
                <p className="text-stone-400 text-center py-4">Nenhuma promoção cadastrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {(localConfig.promoBadges || []).map((badge) => (
                    <div key={badge.id} className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[64px_1fr] gap-2">
                        <input
                          type="text"
                          value={badge.icon || ''}
                          onChange={(e) => handleUpdatePromoBadge(badge.id, { icon: e.target.value })}
                          placeholder="🎉"
                          maxLength={4}
                          className="w-full px-2 py-2 bg-white border border-stone-200 rounded-xl text-center text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <input
                          type="text"
                          value={badge.title}
                          onChange={(e) => handleUpdatePromoBadge(badge.id, { title: e.target.value })}
                          placeholder="Título (ex: Frete grátis hoje!)"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={badge.subtitle || ''}
                        onChange={(e) => handleUpdatePromoBadge(badge.id, { subtitle: e.target.value })}
                        placeholder="Subtítulo opcional (ex: Pedidos acima de R$ 80)"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={badge.couponCode || ''}
                          onChange={(e) => handleUpdatePromoBadge(badge.id, { couponCode: e.target.value.toUpperCase() || undefined })}
                          placeholder="Código do cupom (opcional)"
                          className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePromoBadge(badge.id)}
                          className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remover promoção"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Biblioteca de badges/etiquetas de pratos (Fase 4, itens 5/6) —
                cada restaurante edita a sua própria, sem afetar outros. */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                    <Tag className="w-4 h-4" />
                    Badges de Pratos
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Etiquetas que aparecem nos pratos (ex: Vegano, Picante, Mais Pedido). Crie, edite a cor e
                    oculte as que não usa — mostramos no máximo ~3 por prato pra não poluir o card.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBadge}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo badge</span>
                </button>
              </div>

              <div className="space-y-2">
                {effectiveBadges.map((badge, idx) => (
                  <div
                    key={badge.id}
                    className={`flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 ${
                      badge.active === false ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveBadge(badge.id, -1)}
                        disabled={idx === 0}
                        className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBadge(badge.id, 1)}
                        disabled={idx === effectiveBadges.length - 1}
                        className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-20"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={badge.emoji || ''}
                      onChange={(e) => handleUpdateBadge(badge.id, { emoji: e.target.value })}
                      placeholder="🏷️"
                      maxLength={4}
                      className="w-12 px-1 py-2 bg-white border border-stone-200 rounded-lg text-center text-base focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
                    />
                    <input
                      type="text"
                      value={badge.label}
                      onChange={(e) => handleUpdateBadge(badge.id, { label: e.target.value })}
                      placeholder="Nome do badge"
                      className="flex-1 min-w-0 px-3 py-2 bg-white border border-stone-200 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="color"
                      value={badge.color}
                      onChange={(e) => handleUpdateBadge(badge.id, { color: e.target.value })}
                      title="Cor do badge"
                      className="w-9 h-9 rounded-lg border border-stone-200 shrink-0 cursor-pointer bg-white"
                    />
                    <span
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0"
                      style={{ backgroundColor: `${badge.color}1a`, color: badge.color, border: `1px solid ${badge.color}55` }}
                    >
                      {badge.emoji} {badge.label || 'Prévia'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateBadge(badge.id, { active: badge.active === false })}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
                        badge.active === false ? 'bg-stone-200 text-stone-500' : 'bg-emerald-100 text-emerald-800'
                      }`}
                      title={badge.active === false ? 'Oculto — clique pra reativar' : 'Ativo — clique pra ocultar'}
                    >
                      {badge.active === false ? 'Oculto' : 'Ativo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBadge(badge.id)}
                      className="p-2 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                      title="Excluir badge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DELIVERY ZONES & FEES */}
        {/* ========================================================================= */}
        {activeTab === 'zones' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-stone-900">Bairros Atendidos & Taxas de Entrega</h2>
                <p className="text-xs text-stone-500">
                  Configure as taxas de frete e prazos médios de entrega por bairro atendido
                </p>
              </div>
              <div className="flex items-center gap-2">
                {otherRestaurants && otherRestaurants.length > 0 && (
                  <button
                    id="copy-zones-btn"
                    onClick={() => setIsCopyZonesOpen(true)}
                    className="px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar de outro restaurante</span>
                  </button>
                )}
                <button
                  id="add-zone-btn"
                  onClick={() => handleOpenZoneModal()}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Novo Bairro</span>
                </button>
              </div>
            </div>

            {/* ================= Ajuste Operacional em Tempo Real (Fase 4, itens 14-16) ================= */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <button onClick={() => setShowOperationalPanel((v) => !v)} className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stone-500" />
                  <span className="font-bold text-stone-900 text-sm">Status Operacional</span>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold ${
                      currentOpStatus === 'delayed'
                        ? 'bg-rose-100 text-rose-700'
                        : currentOpStatus === 'busy'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {currentOpStatus === 'delayed' ? '🔴 Atrasado' : currentOpStatus === 'busy' ? '🟡 Movimento alto' : '🟢 Normal'}
                    {currentOpAdjustment > 0 ? ` +${currentOpAdjustment}min` : ''}
                  </span>
                </div>
                {showOperationalPanel ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>

              {showOperationalPanel && (
                <div className="border-t border-stone-200 p-4 space-y-4 text-xs sm:text-sm">
                  <p className="text-[11px] text-stone-500 -mt-1">
                    O ajuste soma ao tempo padrão de cada zona/faixa na hora de mostrar ao cliente — não altera os tempos
                    cadastrados. Pedidos já abertos são atualizados automaticamente, sem o cliente precisar dar refresh.
                    Fórmula: <strong>tempo padrão + ajuste atual = tempo exibido</strong>.
                  </p>

                  <div>
                    <h4 className="font-bold text-stone-800 mb-1.5">Status</h4>
                    <div className="flex gap-1.5">
                      {([
                        ['normal', '🟢 Normal'],
                        ['busy', '🟡 Movimento alto'],
                        ['delayed', '🔴 Atrasado'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => applyOperationalAdjustment(value, currentOpAdjustment)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            currentOpStatus === value ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-800 mb-1.5">Ajuste de tempo atual</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 5, 10, 15, 20, 30].map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => applyOperationalAdjustment(min === 0 ? 'normal' : currentOpStatus === 'normal' ? 'busy' : currentOpStatus, min)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            currentOpAdjustment === min ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          +{min} min
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Motivo (opcional, fica no histórico)</label>
                    <input
                      type="text"
                      value={opReason}
                      onChange={(e) => setOpReason(e.target.value)}
                      placeholder="Ex: chuva forte, cozinha com pedidos acumulados…"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {(localConfig.operationalAdjustmentHistory || []).length > 0 && (
                    <div>
                      <h4 className="font-bold text-stone-800 mb-1.5">Histórico de Ajustes</h4>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {(localConfig.operationalAdjustmentHistory || []).slice(0, 15).map((entry) => (
                          <div key={entry.id} className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200 text-[11px]">
                            <span className="text-stone-400 shrink-0">
                              {new Date(entry.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex-1 truncate">
                              {entry.previousMinutes}min → <strong>+{entry.newMinutes}min</strong>
                              {entry.reason ? ` · ${entry.reason}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ================= Motor de Cálculo de Entrega (Fase 4, itens 9-13) ================= */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
              <button onClick={() => setShowDeliveryEngine((v) => !v)} className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-stone-500" />
                  <span className="font-bold text-stone-900 text-sm">Motor de Cálculo de Entrega</span>
                  <span className="text-[10px] uppercase tracking-wide bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
                    {localConfig.deliveryCalcMethod ? { neighborhood: 'Bairro', cep: 'CEP', distance: 'Distância', formula: 'Fórmula', hybrid: 'Híbrido' }[localConfig.deliveryCalcMethod] : 'Bairro (padrão)'}
                  </span>
                </div>
                {showDeliveryEngine ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>

              {showDeliveryEngine && (
                <div className="border-t border-stone-200 p-4 space-y-5 text-xs sm:text-sm">
                  <p className="text-[11px] text-stone-500 -mt-1">
                    Por padrão a taxa é calculada por bairro (como sempre foi). Só mexa aqui se quiser cobrar por CEP, por
                    distância, por fórmula, ou combinar métodos.
                  </p>

                  {/* Localização do restaurante */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-stone-800">Localização do Restaurante</h4>
                    <p className="text-[11px] text-stone-500">Necessária pros métodos por Distância e Fórmula (usada como origem do cálculo).</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">CEP</label>
                        <input
                          type="text"
                          value={restaurantLocation.cep || ''}
                          onChange={(e) => updateLocation({ cep: e.target.value })}
                          onBlur={(e) => handleLocationCepLookup(e.target.value)}
                          placeholder="00000-000"
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        {locCepLoading && <p className="text-[10px] text-stone-400 mt-0.5">Buscando…</p>}
                        {locCepError && <p className="text-[10px] text-rose-600 mt-0.5">{locCepError}</p>}
                      </div>
                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Rua</label>
                        <input
                          type="text"
                          value={restaurantLocation.street || ''}
                          onChange={(e) => updateLocation({ street: e.target.value })}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Número</label>
                        <input
                          type="text"
                          value={restaurantLocation.number || ''}
                          onChange={(e) => updateLocation({ number: e.target.value })}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Bairro</label>
                        <input
                          type="text"
                          value={restaurantLocation.neighborhood || ''}
                          onChange={(e) => updateLocation({ neighborhood: e.target.value })}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Cidade</label>
                        <input
                          type="text"
                          value={restaurantLocation.city || ''}
                          onChange={(e) => updateLocation({ city: e.target.value })}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-600 mb-1">Estado</label>
                        <input
                          type="text"
                          value={restaurantLocation.state || ''}
                          onChange={(e) => updateLocation({ state: e.target.value })}
                          maxLength={2}
                          className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      {restaurantLocation.lat != null
                        ? `📍 Coordenadas encontradas (lat ${restaurantLocation.lat.toFixed(4)}, lng ${restaurantLocation.lng?.toFixed(4)})`
                        : '📍 Coordenadas ainda não encontradas — preencha o CEP acima pra buscar automaticamente.'}
                    </p>
                  </div>

                  {/* Método de cálculo */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-stone-800">Método de Cálculo</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ['neighborhood', 'Bairro'],
                        ['cep', 'CEP'],
                        ['distance', 'Distância'],
                        ['formula', 'Fórmula'],
                        ['hybrid', 'Híbrido'],
                      ] as const).map(([value, label]) => {
                        const isSelected = (localConfig.deliveryCalcMethod || 'neighborhood') === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateConfigField('deliveryCalcMethod', value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Raio máximo */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Raio máximo de entrega (km)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={localConfig.maxDeliveryRadiusKm ?? ''}
                      onChange={(e) => updateConfigField('maxDeliveryRadiusKm', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="Sem limite"
                      className="w-40 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Endereços além desse raio são recusados como "fora da área", em vez de usar a primeira zona cadastrada.
                    </p>
                  </div>

                  {/* Faixas de CEP */}
                  {localConfig.deliveryCalcMethod === 'cep' && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-800">Faixas de CEP</h4>
                      {cepRanges.map((r) => (
                        <div key={r.id} className={`flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200 ${r.active === false ? 'opacity-50' : ''}`}>
                          <span className="flex-1 text-xs">{r.cepStart}–{r.cepEnd} · {formatCurrency(r.fee)}{r.estimatedMinutes ? ` · ${r.estimatedMinutes}` : ''}</span>
                          <button onClick={() => toggleCepRangeActive(r.id)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-stone-200 text-stone-600">{r.active === false ? 'Oculta' : 'Ativa'}</button>
                          <button onClick={() => openCepRangeForm(r)} className="p-1.5 text-stone-500 hover:bg-stone-200 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteCepRange(r.id)} className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {editingCepRangeId ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                          <input placeholder="CEP início" value={cepDraft.cepStart} onChange={(e) => setCepDraft({ ...cepDraft, cepStart: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="CEP fim" value={cepDraft.cepEnd} onChange={(e) => setCepDraft({ ...cepDraft, cepEnd: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Taxa R$" value={cepDraft.fee} onChange={(e) => setCepDraft({ ...cepDraft, fee: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Tempo (ex: 30-40 min)" value={cepDraft.estimatedMinutes} onChange={(e) => setCepDraft({ ...cepDraft, estimatedMinutes: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <div className="flex gap-1">
                            <button onClick={saveCepRangeForm} className="flex-1 px-2 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold">Salvar</button>
                            <button onClick={() => setEditingCepRangeId(null)} className="px-2 py-1.5 text-stone-500 text-xs font-bold">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openCepRangeForm()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-600 text-xs font-bold">
                          <Plus className="w-3.5 h-3.5" /> Nova faixa de CEP
                        </button>
                      )}
                    </div>
                  )}

                  {/* Faixas de distância */}
                  {(localConfig.deliveryCalcMethod === 'distance' || localConfig.deliveryCalcMethod === 'hybrid') && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-800">Faixas de Distância (km)</h4>
                      {distanceTiers.map((t) => (
                        <div key={t.id} className={`flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200 ${t.active === false ? 'opacity-50' : ''}`}>
                          <span className="flex-1 text-xs">
                            {t.fromKm}–{t.toKm}km · {formatCurrency(t.fee)}
                            {t.prepMinutes != null && t.deliveryMinutes != null ? ` · Preparo ${t.prepMinutes}min + Entrega ${t.deliveryMinutes}min` : ''}
                          </span>
                          <button onClick={() => toggleTierActive(t.id)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-stone-200 text-stone-600">{t.active === false ? 'Oculta' : 'Ativa'}</button>
                          <button onClick={() => openTierForm(t)} className="p-1.5 text-stone-500 hover:bg-stone-200 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteTier(t.id)} className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {editingTierId ? (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                          <input placeholder="De (km)" value={tierDraft.fromKm} onChange={(e) => setTierDraft({ ...tierDraft, fromKm: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Até (km)" value={tierDraft.toKm} onChange={(e) => setTierDraft({ ...tierDraft, toKm: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Taxa R$" value={tierDraft.fee} onChange={(e) => setTierDraft({ ...tierDraft, fee: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Preparo (min)" value={tierDraft.prepMinutes} onChange={(e) => setTierDraft({ ...tierDraft, prepMinutes: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <input placeholder="Entrega (min)" value={tierDraft.deliveryMinutes} onChange={(e) => setTierDraft({ ...tierDraft, deliveryMinutes: e.target.value })} className="px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs" />
                          <div className="flex gap-1 col-span-2 sm:col-span-5">
                            <button onClick={saveTierForm} className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold">Salvar</button>
                            <button onClick={() => setEditingTierId(null)} className="px-3 py-1.5 text-stone-500 text-xs font-bold">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openTierForm()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-600 text-xs font-bold">
                          <Plus className="w-3.5 h-3.5" /> Nova faixa de distância
                        </button>
                      )}
                    </div>
                  )}

                  {/* Fórmula */}
                  {localConfig.deliveryCalcMethod === 'formula' && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-800">Fórmula por Distância</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Taxa base (R$)</label>
                          <input
                            type="number" step="0.01"
                            value={localConfig.deliveryFormula?.baseFee ?? ''}
                            onChange={(e) => updateConfigField('deliveryFormula', { baseFee: parseFloat(e.target.value) || 0, includedKm: localConfig.deliveryFormula?.includedKm ?? 0, extraFeePerKm: localConfig.deliveryFormula?.extraFeePerKm ?? 0 })}
                            className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Km incluído</label>
                          <input
                            type="number" step="0.1"
                            value={localConfig.deliveryFormula?.includedKm ?? ''}
                            onChange={(e) => updateConfigField('deliveryFormula', { baseFee: localConfig.deliveryFormula?.baseFee ?? 0, includedKm: parseFloat(e.target.value) || 0, extraFeePerKm: localConfig.deliveryFormula?.extraFeePerKm ?? 0 })}
                            className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Adicional/km (R$)</label>
                          <input
                            type="number" step="0.01"
                            value={localConfig.deliveryFormula?.extraFeePerKm ?? ''}
                            onChange={(e) => updateConfigField('deliveryFormula', { baseFee: localConfig.deliveryFormula?.baseFee ?? 0, includedKm: localConfig.deliveryFormula?.includedKm ?? 0, extraFeePerKm: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prioridade híbrida */}
                  {localConfig.deliveryCalcMethod === 'hybrid' && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-stone-800">Ordem de Prioridade (Híbrido)</h4>
                      <p className="text-[11px] text-stone-500">O sistema tenta cada método nessa ordem até um resolver o endereço do cliente.</p>
                      {hybridPriority.map((method, idx) => (
                        <div key={method} className="flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200">
                          <span className="text-xs font-bold text-stone-400 w-5">{idx + 1}º</span>
                          <span className="flex-1 text-xs font-semibold">{HYBRID_METHOD_LABELS[method] || method}</span>
                          <button onClick={() => moveHybridPriority(method, -1)} disabled={idx === 0} className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => moveHybridPriority(method, 1)} disabled={idx === hybridPriority.length - 1} className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <p className="text-[11px] text-stone-400">Configure as faixas de CEP e de Distância acima — o método Bairro usa os bairros já cadastrados nesta aba.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isCopyZonesOpen && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setIsCopyZonesOpen(false)}>
                <div
                  className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 text-xs sm:text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-black text-stone-900 text-sm">Copiar bairros de outro restaurante</h3>
                  <p className="text-stone-500 text-[11px]">
                    Os bairros do restaurante escolhido serão adicionados aos já cadastrados aqui
                    (nada é apagado).
                  </p>
                  <select
                    value={copyZonesSourceSlug}
                    onChange={(e) => setCopyZonesSourceSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Selecione um restaurante...</option>
                    {(otherRestaurants || []).map((r) => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                  {copyZonesError && <p className="text-rose-600 font-semibold">{copyZonesError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCopyZonesOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!copyZonesSourceSlug || copyZonesLoading}
                      onClick={handleCopyZonesFromRestaurant}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50"
                    >
                      {copyZonesLoading ? 'Copiando...' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(localConfig.deliveryZones || []).map((zone) => (
                <div
                  key={zone.id}
                  className={`bg-white p-4 rounded-2xl border transition-all ${
                    zone.active ? 'border-stone-200 shadow-xs' : 'border-stone-200 opacity-60 bg-stone-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-stone-900 text-base">{zone.neighborhood}</h4>
                      <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-500" />
                        {zone.estimatedMinutes}
                      </p>
                    </div>
                    <span className="text-sm font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                      {formatCurrency(zone.fee)}
                    </span>
                  </div>

                  <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleToggleZoneActive(zone.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold ${
                        zone.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {zone.active ? 'Ativo' : 'Inativo'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenZoneModal(zone)}
                        className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DRIVER / MOTOBOY MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-stone-900">Equipe de Entregadores (Motoboys)</h2>
                <p className="text-xs text-stone-500">
                  Cadastre os motoboys da sua frota e acompanhe disponibilidade em tempo real
                </p>
              </div>
              <div className="flex items-center gap-2">
                {otherRestaurants && otherRestaurants.length > 0 && (
                  <button
                    id="copy-drivers-btn"
                    onClick={() => setIsCopyDriversOpen(true)}
                    className="px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar de outro restaurante</span>
                  </button>
                )}
                <button
                  id="add-driver-btn"
                  onClick={() => handleOpenDriverModal()}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Entregador</span>
                </button>
              </div>
            </div>

            {isCopyDriversOpen && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setIsCopyDriversOpen(false)}>
                <div
                  className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3 text-xs sm:text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-black text-stone-900 text-sm">Copiar entregadores de outro restaurante</h3>
                  <p className="text-stone-500 text-[11px]">
                    Os motoboys do restaurante escolhido serão adicionados à sua frota, todos como
                    "Offline" até você confirmar disponibilidade (nada é apagado daqui).
                  </p>
                  <select
                    value={copyDriversSourceSlug}
                    onChange={(e) => setCopyDriversSourceSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Selecione um restaurante...</option>
                    {(otherRestaurants || []).map((r) => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                  {copyDriversError && <p className="text-rose-600 font-semibold">{copyDriversError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCopyDriversOpen(false)}
                      className="flex-1 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!copyDriversSourceSlug || copyDriversLoading}
                      onClick={handleCopyDriversFromRestaurant}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50"
                    >
                      {copyDriversLoading ? 'Copiando...' : 'Copiar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(localConfig.drivers || []).map((driver) => (
                <div
                  key={driver.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={driver.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                      alt={driver.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-extrabold text-stone-900 text-sm">{driver.name}</h4>
                      <p className="text-xs text-stone-500">{driver.vehicle} • {driver.plate}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-stone-50 p-2 rounded-xl">
                    <span className="text-stone-600 font-medium">WhatsApp: {driver.phone}</span>
                    <a
                      href={`https://wa.me/${driver.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"
                      title="Chamar no WhatsApp"
                    >
                      <Phone className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleDriverStatus(driver.id)}
                      className={`px-3 py-1 rounded-full text-xs font-black transition-all ${
                        driver.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : driver.status === 'busy'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {driver.status === 'available' ? '🟢 Disponível' : driver.status === 'busy' ? '🟣 Em Entrega' : '⚪ Offline'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenDriverModal(driver)}
                        className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDriver(driver.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: RESTAURANT STORE CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === 'config' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div>
              <h2 className="text-lg font-black text-stone-900">Configurações do Estabelecimento Delivery</h2>
              <p className="text-xs text-stone-500">
                Ajuste os dados cadastrais, pedido mínimo, chave Pix e WhatsApp
              </p>
            </div>

            {configSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                <Check className="w-4 h-4" />
                <span>Configurações salvas com sucesso!</span>
              </div>
            )}

            {/* 🎨 Aparência e Página Inicial — identidade visual completa deste
                restaurante: capa ajustável, logo, nome/slogan, cores, layout
                escolhido entre os 10 disponíveis, e o splash de boas-vindas.
                Tudo salva pelo mesmo saveRestaurantConfig já existente. */}
            <div>
              <h3 className="font-black text-stone-900 flex items-center gap-1.5 mb-1">
                <Palette className="w-4 h-4" />
                🎨 Aparência e Página Inicial
              </h3>
              <p className="text-[11px] text-stone-500 mb-3">
                Como este restaurante aparece na vitrine "Escolha seu restaurante" e no
                próprio cardápio — capa, identidade, cores, layout e splash de abertura
              </p>
            </div>

            {/* Capa do restaurante: upload + ajuste de enquadramento/zoom/overlay,
                pra imagem nunca ficar deformada nem cortar a comida em nenhuma tela */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div>
                <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                  <ImageOff className="w-4 h-4" />
                  Capa do Restaurante
                </h3>
                <p className="text-[11px] text-stone-500">
                  Foto grande de capa exibida no topo do cardápio e usada como foto do
                  card deste restaurante na vitrine principal
                </p>
              </div>

              {localConfig.bannerImage && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                  <img
                    src={localConfig.bannerImage}
                    alt="Pré-visualização da capa"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${localConfig.bannerPositionX ?? 50}% ${localConfig.bannerPositionY ?? 50}%`,
                      transform: `scale(${(localConfig.bannerZoom ?? 100) / 100})`,
                    }}
                  />
                  {(localConfig.bannerOverlay ?? 0) > 0 && (
                    <div className="absolute inset-0 bg-black" style={{ opacity: (localConfig.bannerOverlay ?? 0) / 100 }} />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUploadField
                  slug={slug}
                  token={token}
                  label="Logo do Restaurante"
                  mediaKind="logo"
                  entityType="restaurant"
                  entityId={slug}
                  value={localConfig.logo}
                  onChange={(url) => {
                    const updated = { ...localConfig, logo: url };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  }}
                  aspect="square"
                />
                <ImageUploadField
                  slug={slug}
                  token={token}
                  label="Alterar capa"
                  mediaKind="banner"
                  entityType="restaurant"
                  entityId={slug}
                  value={localConfig.bannerImage}
                  onChange={(url) => {
                    const updated = { ...localConfig, bannerImage: url };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  }}
                  aspect="wide"
                />
              </div>

              {localConfig.bannerImage && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                      <Move className="w-3 h-3" /> Posição H
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={localConfig.bannerPositionX ?? 50}
                      onChange={(e) => {
                        const updated = { ...localConfig, bannerPositionX: parseInt(e.target.value) };
                        setLocalConfig(updated);
                        onUpdateConfig(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Posição V</label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={localConfig.bannerPositionY ?? 50}
                      onChange={(e) => {
                        const updated = { ...localConfig, bannerPositionY: parseInt(e.target.value) };
                        setLocalConfig(updated);
                        onUpdateConfig(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Zoom</label>
                    <input
                      type="range"
                      min={100}
                      max={180}
                      value={localConfig.bannerZoom ?? 100}
                      onChange={(e) => {
                        const updated = { ...localConfig, bannerZoom: parseInt(e.target.value) };
                        setLocalConfig(updated);
                        onUpdateConfig(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Overlay escuro</label>
                    <input
                      type="range"
                      min={0}
                      max={70}
                      value={localConfig.bannerOverlay ?? 60}
                      onChange={(e) => {
                        const updated = { ...localConfig, bannerOverlay: parseInt(e.target.value) };
                        setLocalConfig(updated);
                        onUpdateConfig(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-stone-700 mb-1">Texto sobre a capa (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: Frete grátis hoje, Novidade no cardápio..."
                      maxLength={80}
                      value={localConfig.bannerText ?? ''}
                      onChange={(e) => {
                        const updated = { ...localConfig, bannerText: e.target.value };
                        setLocalConfig(updated);
                        onUpdateConfig(updated);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cores da identidade — nunca fixas, vêm daqui pra vitrine e pro
                card deste restaurante em QUALQUER layout escolhido */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div>
                <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                  <Palette className="w-4 h-4" />
                  Cores
                </h3>
                <p className="text-[11px] text-stone-500">
                  Cor principal e secundária usadas no card deste restaurante na vitrine
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Cor Principal</label>
                  <input
                    type="color"
                    value={localConfig.color || '#B45309'}
                    onChange={(e) => {
                      const updated = { ...localConfig, color: e.target.value };
                      setLocalConfig(updated);
                      onUpdateConfig(updated);
                    }}
                    className="w-14 h-10 rounded-lg border border-stone-200 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Cor Secundária</label>
                  <input
                    type="color"
                    value={localConfig.secondaryColor || localConfig.color || '#78350F'}
                    onChange={(e) => {
                      const updated = { ...localConfig, secondaryColor: e.target.value };
                      setLocalConfig(updated);
                      onUpdateConfig(updated);
                    }}
                    className="w-14 h-10 rounded-lg border border-stone-200 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Layout — um dos 10 estilos visuais disponíveis pro card deste
                restaurante na vitrine "Escolha seu restaurante" */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                    <LayoutGrid className="w-4 h-4" />
                    Layout da Página Inicial
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Estilo visual do card deste restaurante na vitrine principal — as cores
                    usadas em cada estilo vêm sempre da identidade configurada acima
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLayoutPreview(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold min-h-[44px]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Pré-visualizar
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LAYOUTS.map((l, idx) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      const updated = { ...localConfig, layout: l.id };
                      setLocalConfig(updated);
                      onUpdateConfig(updated);
                    }}
                    className={`relative p-2.5 rounded-xl border-2 text-left transition-colors ${
                      (localConfig.layout || 'galeria-gourmet') === l.id
                        ? 'border-amber-500 ring-2 ring-amber-200'
                        : 'border-stone-200 hover:border-stone-300'
                    } ${l.pageBg}`}
                  >
                    <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-white/80 text-[9px] font-black text-stone-800 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className={`block text-[10px] font-bold mt-3.5 ${l.pageText}`}>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {showLayoutPreview && (
              <LayoutPreviewModal
                open={showLayoutPreview}
                onClose={() => setShowLayoutPreview(false)}
                title="Escolha seu restaurante"
                subtitle="Cada loja tem seu próprio cardápio e pedidos"
                pageLayout="galeria-gourmet"
                highlightSlug={slug}
                restaurants={[
                  {
                    slug,
                    name: localConfig.name || 'Seu Restaurante',
                    tagline: localConfig.tagline,
                    photo: localConfig.bannerImage || localConfig.logo,
                    color: localConfig.color,
                    secondaryColor: localConfig.secondaryColor,
                    layout: localConfig.layout,
                    bannerPositionX: localConfig.bannerPositionX,
                    bannerPositionY: localConfig.bannerPositionY,
                    bannerZoom: localConfig.bannerZoom,
                  },
                  { name: 'Outro Restaurante', tagline: 'Exemplo de card vizinho', color: '#6B7280' },
                  { name: 'Mais um Restaurante', tagline: 'Exemplo de card vizinho', color: '#6B7280' },
                ]}
              />
            )}

            {/* Splash de Boas-vindas: fotos em tela cheia mostradas por alguns
                segundos antes do cardápio abrir, estilo iFood/Uber Eats/Airbnb.
                Cada foto aceita ajuste individual de enquadramento/zoom/overlay/texto. */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                    <Images className="w-4 h-4" />
                    ✨ Sequência de fotos ao abrir o app
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Fotos em tela cheia (pratos, ambiente, promoções) mostradas por alguns
                    segundos antes do cliente ver o cardápio
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!!localConfig.splashEnabled}
                    onChange={(e) => {
                      const updated = { ...localConfig, splashEnabled: e.target.checked };
                      setLocalConfig(updated);
                      onUpdateConfig(updated);
                    }}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-bold text-stone-800">Ativada</span>
                </label>
              </div>

              <div className="space-y-3">
                {(localConfig.splashImages || []).map((raw, idx) => {
                  const img = normalizeSplashImage(raw);
                  const total = (localConfig.splashImages || []).length;
                  const updateImage = (patch: Partial<typeof img>) => {
                    const images = (localConfig.splashImages || []).map(normalizeSplashImage);
                    images[idx] = { ...images[idx], ...patch };
                    const updated = { ...localConfig, splashImages: images };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  };
                  // Reordena trocando a foto de lugar com a vizinha (sem lib de
                  // drag-and-drop) — simples, acessível por clique/teclado.
                  const moveImage = (direction: -1 | 1) => {
                    const images = (localConfig.splashImages || []).map(normalizeSplashImage);
                    const targetIdx = idx + direction;
                    if (targetIdx < 0 || targetIdx >= images.length) return;
                    [images[idx], images[targetIdx]] = [images[targetIdx], images[idx]];
                    const updated = { ...localConfig, splashImages: images };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  };
                  return (
                    <div key={img.url + idx} className="rounded-xl border border-stone-200 overflow-hidden">
                      <div className="flex gap-3 p-3">
                        {/* Reordenar: sobe/desce na sequência (posição atual em destaque) */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                          <button
                            type="button"
                            onClick={() => moveImage(-1)}
                            disabled={idx === 0}
                            className="p-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover pra cima na sequência"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-black text-stone-400 w-4 text-center">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => moveImage(1)}
                            disabled={idx === total - 1}
                            className="p-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover pra baixo na sequência"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-stone-200">
                          <img
                            src={img.url}
                            alt={`Splash ${idx + 1}`}
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%`,
                              transform: `scale(${(img.zoom ?? 100) / 100})`,
                            }}
                          />
                          {(img.overlay ?? 0) > 0 && (
                            <div className="absolute inset-0 bg-black" style={{ opacity: (img.overlay ?? 0) / 100 }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-bold text-stone-600 col-span-2 flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={img.enabled !== false}
                              onChange={(e) => updateImage({ enabled: e.target.checked })}
                              className="w-3.5 h-3.5 rounded text-amber-600"
                            />
                            Ativa nesta sequência
                          </label>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500">Zoom</label>
                            <input
                              type="range"
                              min={100}
                              max={180}
                              value={img.zoom ?? 100}
                              onChange={(e) => updateImage({ zoom: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500">Overlay</label>
                            <input
                              type="range"
                              min={0}
                              max={70}
                              value={img.overlay ?? 0}
                              onChange={(e) => updateImage({ overlay: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500">Posição H</label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={img.positionX ?? 50}
                              onChange={(e) => updateImage({ positionX: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500">Posição V</label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={img.positionY ?? 50}
                              onChange={(e) => updateImage({ positionY: parseInt(e.target.value) })}
                              className="w-full"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Texto opcional sobre a foto"
                            value={img.text || ''}
                            onChange={(e) => updateImage({ text: e.target.value })}
                            className="col-span-2 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...localConfig,
                              splashImages: (localConfig.splashImages || []).filter((_, i) => i !== idx),
                            };
                            setLocalConfig(updated);
                            onUpdateConfig(updated);
                          }}
                          className="self-start p-1.5 rounded-lg bg-stone-100 hover:bg-red-50 hover:text-red-600 text-stone-500 transition-colors shrink-0"
                          title="Remover foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <ImageUploadField
                slug={slug}
                token={token}
                label={`Adicionar foto à sequência${(localConfig.splashImages?.length || 0) > 0 ? ` (${localConfig.splashImages!.length} já cadastradas)` : ''}`}
                mediaKind="splash"
                entityType="restaurant"
                entityId={slug}
                value=""
                onChange={async (url) => {
                  const newImage = { url, positionX: 50, positionY: 50, zoom: 100, overlay: 0, text: '', enabled: true };
                  const updated = { ...localConfig, splashImages: [...(localConfig.splashImages || []), newImage] };
                  setLocalConfig(updated);
                  const ok = await onUpdateConfig(updated);
                  if (!ok) {
                    setLocalConfig((current) => ({
                      ...current,
                      splashImages: (current.splashImages || []).filter((img) => img.url !== url),
                    }));
                  }
                }}
                aspect="wide"
              />

              <div>
                <label className="block font-bold text-stone-700 mb-1">Segundos por foto</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={localConfig.splashDurationSeconds || 3}
                  onChange={(e) => {
                    const updated = { ...localConfig, splashDurationSeconds: parseInt(e.target.value) || 3 };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-24 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Impressão: tamanho de papel padrão da impressora térmica.
                Impressão automática fica registrada aqui como preferência,
                mas depende de um driver/app de impressora do sistema
                operacional pra funcionar sem clique manual — o navegador
                sozinho não consegue imprimir silenciosamente. */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4 text-xs sm:text-sm">
              <div>
                <h3 className="font-black text-stone-900 flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  Impressão
                </h3>
                <p className="text-[11px] text-stone-500">
                  Tamanho padrão do papel da impressora térmica usada no restaurante
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(['58mm', '80mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      const updated = { ...localConfig, printPaperWidth: w };
                      setLocalConfig(updated);
                      onUpdateConfig(updated);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      (localConfig.printPaperWidth || '80mm') === w
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!localConfig.printAutoNewOrders}
                  onChange={(e) => {
                    const updated = { ...localConfig, printAutoNewOrders: e.target.checked };
                    setLocalConfig(updated);
                    onUpdateConfig(updated);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="font-bold text-stone-800 block">Impressão automática de novos pedidos</span>
                  <span className="text-[11px] text-stone-500">
                    Guarda a preferência pra quando houver um app/driver de impressora instalado no
                    computador da cozinha. Sozinho, o navegador não consegue mandar imprimir sem um
                    clique — por segurança, nenhum site pode acionar sua impressora sem confirmação.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: METRICS & SALES DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'metrics' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-stone-900">Métricas & Faturamento do Delivery</h2>
              <p className="text-xs text-stone-500">
                Resumo analítico das vendas, taxa de entrega e desempenho dos pedidos
              </p>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 uppercase">Faturamento Total</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-stone-900 mt-2">
                  {formatCurrency(totalRevenue)}
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  ↑ Em tempo real
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 uppercase">Total de Pedidos</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-stone-900 mt-2">
                  {validOrdersCount} pedidos
                </h3>
                <span className="text-[11px] text-stone-400 font-medium mt-1 block">
                  {finishedOrders.length} entregues com sucesso
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 uppercase">Ticket Médio</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-stone-900 mt-2">
                  {formatCurrency(averageTicket)}
                </h3>
                <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
                  Média por entrega
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-500 uppercase">Total em Taxas Frete</span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <Bike className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-stone-900 mt-2">
                  {formatCurrency(deliveryRevenue)}
                </h3>
                <span className="text-[11px] text-purple-600 font-semibold mt-1 block">
                  Arrecadado em fretes
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: TOOLS HUB (CMV, QR CODE, BACKUP, SIMULATOR, PROMOTIONS) */}
        {/* ========================================================================= */}
        {activeTab === 'tools' && (
          <ToolsHub
            orders={orders}
            token={token}
            slug={slug}
            onOpenPlatform={onOpenPlatform}
            onOpenUsers={onOpenUsers}
            menuItems={menuItems}
            restaurantConfig={localConfig}
            onUpdateConfig={(newConfig) => {
              setLocalConfig(newConfig);
              onUpdateConfig(newConfig);
            }}
            onInjectDemoOrder={onInjectDemoOrder}
            onUpdateMenuItems={onUpdateMenuItems}
          />
        )}

        {activeTab === 'notifications' && <NotificationsPanel slug={slug} token={token} />}

        {activeTab === 'ai' && <AdminAiPanel slug={slug} token={token} />}
      </main>

      {/* Dispatch Modal: Assign Driver */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                <Bike className="w-5 h-5 text-amber-500" />
                Despachar Pedido #{dispatchOrder.orderNumber}
              </h3>
              <button onClick={() => setDispatchOrder(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl space-y-1">
              <p><strong>Cliente:</strong> {dispatchOrder.customer.name}</p>
              <p><strong>Endereço:</strong> {dispatchOrder.customer.address?.street}, {dispatchOrder.customer.address?.number} - {dispatchOrder.customer.address?.neighborhood}</p>
              <p><strong>Total:</strong> {formatCurrency(dispatchOrder.total)}</p>
            </div>

            <div>
              <label className="block font-bold text-stone-700 text-xs mb-1.5">
                Selecione o Motoboy para esta Entrega:
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {(localConfig.drivers || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicle} - {d.plate}) - {d.status === 'available' ? '🟢 Disponível' : '🟣 Em rota'}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchOrder(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Saída</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelar pedido — motivo obrigatório, fica registrado no histórico */}
      {cancelOrderTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                <X className="w-5 h-5 text-rose-500" />
                Cancelar Pedido #{cancelOrderTarget.orderNumber}
              </h3>
              <button
                onClick={() => {
                  setCancelOrderTarget(null);
                  setCancelReasonInput('');
                }}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl space-y-1">
              <p><strong>Cliente:</strong> {cancelOrderTarget.customer.name}</p>
              <p><strong>Total:</strong> {formatCurrency(cancelOrderTarget.total)}</p>
            </div>

            <div>
              <label className="block font-bold text-stone-700 text-xs mb-1.5">
                Motivo do cancelamento (obrigatório):
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CANCEL_REASON_SUGGESTIONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      cancelReasonInput === reason
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo do cancelamento..."
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelOrderTarget(null);
                  setCancelReasonInput('');
                }}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={!cancelReasonInput.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <X className="w-4 h-4" />
                <span>Confirmar Cancelamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelar selecionados — item 24 */}
      {showBulkCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-stone-900 flex items-center gap-2">
                <X className="w-5 h-5 text-rose-500" />
                Cancelar {selectedOrderIds.size} pedido(s)
              </h3>
              <button
                onClick={() => setShowBulkCancelModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block font-bold text-stone-700 text-xs mb-1.5">Motivo do cancelamento (obrigatório):</label>
              <textarea
                value={bulkCancelReasonInput}
                onChange={(e) => setBulkCancelReasonInput(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo do cancelamento em massa..."
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="pt-1 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkCancelModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmBulkCancel}
                disabled={!bulkCancelReasonInput.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelar todos — item 25, protegido com confirmação forte */}
      {showCancelAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-rose-300 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-rose-700 flex items-center gap-2">
                ⚠️ ATENÇÃO — Cancelar todos
              </h3>
              <button
                onClick={() => setShowCancelAllModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
              Você está prestes a cancelar todos os {cancellableOrders.length} pedidos atualmente elegíveis
              (não afeta pedidos já entregues ou já cancelados). Esta ação não pode ser desfeita.
            </p>
            <div>
              <label className="block font-bold text-stone-700 text-xs mb-1.5">Motivo do cancelamento (obrigatório):</label>
              <textarea
                value={cancelAllReasonInput}
                onChange={(e) => setCancelAllReasonInput(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo..."
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-stone-700 text-xs mb-1.5">
                Digite <span className="font-black text-rose-700">CANCELAR</span> para confirmar:
              </label>
              <input
                value={cancelAllConfirmText}
                onChange={(e) => setCancelAllConfirmText(e.target.value)}
                placeholder="CANCELAR"
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="pt-1 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelAllModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancelAll}
                disabled={cancelAllConfirmText.trim().toUpperCase() !== 'CANCELAR' || !cancelAllReasonInput.trim()}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl font-bold text-xs"
              >
                Cancelar todos definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone Add/Edit Modal */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-stone-900">
                {editingZone ? `Editar Bairro: ${editingZone.neighborhood}` : 'Adicionar Novo Bairro'}
              </h3>
              <button onClick={() => setIsZoneModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZoneSubmit} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Nome do Bairro *</label>
                <input
                  type="text"
                  required
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Ex: Pinheiros, Jardins, Centro..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Taxa de Frete (R$) *</label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={zoneFee}
                    onChange={(e) => setZoneFee(e.target.value)}
                    placeholder="8.00"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Tempo Estimado</label>
                  <input
                    type="text"
                    value={zoneEstTime}
                    onChange={(e) => setZoneEstTime(e.target.value)}
                    placeholder="30 - 45 min"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-xs"
                >
                  Salvar Bairro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Add/Edit Modal */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-black text-base text-stone-900">
                {editingDriver ? `Editar: ${editingDriver.name}` : 'Cadastrar Novo Motoboy'}
              </h3>
              <button onClick={() => setIsDriverModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverSubmit} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ex: Carlos Andrade"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Placa da Moto</label>
                  <input
                    type="text"
                    value={driverPlate}
                    onChange={(e) => setDriverPlate(e.target.value)}
                    placeholder="BRA2E19"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Modelo da Moto / Veículo</label>
                <input
                  type="text"
                  value={driverVehicle}
                  onChange={(e) => setDriverVehicle(e.target.value)}
                  placeholder="Ex: Honda CG 160 Fan Vermelha"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <ImageUploadField
                  slug={slug}
                  token={token}
                  label="Foto de Perfil do Entregador"
                  mediaKind="courier"
                  entityType="courier"
                  entityId={editingDriver?.id || undefined}
                  value={driverPhoto}
                  onChange={setDriverPhoto}
                  onUploadingChange={setDriverPhotoUploading}
                  aspect="square"
                />
              </div>

              <div className="pt-3 flex justify-end items-center gap-2 flex-wrap">
                {driverPhotoUploading && (
                  <span className="text-[11px] text-amber-600 font-semibold mr-auto">Enviando foto, aguarde…</span>
                )}
                {!driverPhotoUploading && driverSaveError && (
                  <span className="text-[11px] text-rose-600 font-semibold mr-auto">⚠️ {driverSaveError}</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={driverPhotoUploading || driverSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {driverSaving ? 'Salvando…' : 'Salvar Entregador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dish Add/Edit Modal */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-black text-base">
                {editingDish ? `Editar: ${editingDish.name}` : 'Adicionar Novo Prato ao Cardápio'}
              </h3>
              <button
                onClick={() => setIsDishModalOpen(false)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDishSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Nome do Prato *</label>
                <input
                  type="text"
                  required
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="Ex: Burger Bacon Supremo"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Categoria *</label>
                  <select
                    value={dishCategory}
                    onChange={(e) => setDishCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 capitalize"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    placeholder="39.90"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Descrição e Ingredientes</label>
                <textarea
                  rows={2}
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  placeholder="Descreva os ingredientes frescos e detalhes do preparo..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <ImageUploadField
                  slug={slug}
                  token={token}
                  label="Foto do Prato"
                  mediaKind="product"
                  entityType="menu_item"
                  entityId={editingDish?.id || undefined}
                  value={dishImage}
                  onChange={setDishImage}
                  onUploadingChange={setDishImageUploading}
                  aspect="wide"
                />
                <details className="mt-1.5">
                  <summary className="text-[11px] text-stone-400 cursor-pointer hover:text-stone-600">
                    ou usar uma URL de imagem existente
                  </summary>
                  <input
                    type="url"
                    value={dishImage}
                    onChange={(e) => setDishImage(e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5 w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </details>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Tempo de Preparo (min)</label>
                  <input
                    type="number"
                    value={dishPrepTime}
                    onChange={(e) => setDishPrepTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">Serve quantas pessoas?</label>
                  <input
                    type="number"
                    value={dishServes}
                    onChange={(e) => setDishServes(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1.5">
                  Badges <span className="font-normal text-stone-400">(mostramos no máximo ~3 no card, pra não poluir)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(localConfig.badges && localConfig.badges.length > 0
                    ? localConfig.badges
                    : DEFAULT_BADGES
                  )
                    .filter((b) => b.active !== false)
                    .map((b) => {
                      const isChecked = dishTags.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setDishTags(isChecked ? dishTags.filter((t) => t !== b.id) : [...dishTags, b.id])
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors"
                          style={
                            isChecked
                              ? { backgroundColor: b.color, color: '#fff', borderColor: b.color }
                              : { backgroundColor: `${b.color}0d`, color: b.color, borderColor: `${b.color}55` }
                          }
                        >
                          {b.emoji} {b.label}
                        </button>
                      );
                    })}
                  {(!localConfig.badges || localConfig.badges.length === 0) && (
                    <p className="text-[11px] text-stone-400 w-full mt-1">
                      Usando os badges padrão — personalize em Identidade → Badges de Pratos.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end items-center gap-2 flex-wrap">
                {dishImageUploading && (
                  <span className="text-[11px] text-amber-600 font-semibold mr-auto">Enviando foto, aguarde…</span>
                )}
                {!dishImageUploading && dishSaveError && (
                  <span className="text-[11px] text-rose-600 font-semibold mr-auto">⚠️ {dishSaveError}</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={dishImageUploading || dishSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dishSaving ? 'Salvando…' : editingDish ? 'Salvar Alterações' : 'Adicionar Prato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Impressão do pedido (cozinha / entrega / cliente) */}
      {selectedReceiptOrder && (
        <ReceiptPrintModal
          order={selectedReceiptOrder}
          restaurantConfig={localConfig}
          onClose={() => setSelectedReceiptOrder(null)}
          printState={printStates[selectedReceiptOrder.id] || 'pendente'}
          onPrintStateChange={(state) => { setPrintState(selectedReceiptOrder.id, state); void persistPrintJobState(state); }}
        />
      )}

      {/* Excluir categoria com produtos: pede pra mover os produtos pra outra
          categoria antes — nunca apaga produto junto com a categoria. */}
      {categoryPendingDelete && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
            <div>
              <h3 className="font-black text-stone-900">Esta categoria possui produtos</h3>
              <p className="text-xs text-stone-500 mt-1">
                "{categoryPendingDelete.name}" tem {menuItems.filter((i) => i.categoryId === categoryPendingDelete.id).length} produto(s).
                Escolha pra qual categoria eles devem ir antes de excluir:
              </p>
            </div>
            {categories.filter((c) => c.id !== categoryPendingDelete.id).length === 0 ? (
              <p className="text-xs text-rose-600 font-semibold">
                Não há outra categoria pra mover os produtos. Crie outra categoria primeiro.
              </p>
            ) : (
              <select
                value={moveProductsTargetId}
                onChange={(e) => setMoveProductsTargetId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {categories
                  .filter((c) => c.id !== categoryPendingDelete.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCategoryPendingDelete(null);
                  setMoveProductsTargetId('');
                }}
                className="px-3 py-2 text-xs font-bold text-stone-500 hover:text-stone-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmMoveProductsAndDelete}
                disabled={!moveProductsTargetId}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl disabled:opacity-40"
              >
                Mover produtos e excluir
              </button>
            </div>
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-stone-950/95 backdrop-blur-xl border-t border-stone-800 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-4 gap-1">
          {([['orders','Pedidos',ShoppingBag],['menu','Cardápio',Layers],['identity','Restaurante',Settings],['tools','Mais',Wrench]] as const).map(([id,label,Icon]) => (
            <button key={id} onClick={() => setActiveTab(id as any)} className={`min-h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${activeTab===id?'bg-amber-500 text-stone-950':'text-stone-400'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </nav>
    </div>

  );
};
