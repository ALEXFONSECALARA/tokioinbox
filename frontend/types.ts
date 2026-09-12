// `DietaryTag` continua existindo por compatibilidade de import (nada mais
// restringe MenuItem.tags a esses 9 valores fixos) — na prática agora é só
// um alias de string: um item.tags guarda IDs de badges da biblioteca
// editável do restaurante (RestaurantConfig.badges, Fase 4 itens 5/6),
// resolvidos via getBadgeInfo(). Os 9 valores antigos continuam funcionando
// sem migração porque viraram os IDs dos badges padrão (DEFAULT_BADGES).
export type DietaryTag = string;

// Badge/etiqueta de prato, totalmente editável por restaurante (Fase 4,
// itens 5 e 6) — cada restaurante tem sua própria lista em
// RestaurantConfig.badges, nunca compartilhada com outro restaurante.
export interface RestaurantBadge {
  id: string;
  label: string;
  emoji?: string;
  // Cor em hex (ex: "#ea580c") — aplicada via estilo inline no card/modal,
  // não depende de classes Tailwind pré-compiladas (que não existiriam pra
  // uma cor escolhida livremente pelo restaurante).
  color: string;
  // Badge oculta não aparece mais pra seleção em pratos nem é exibida, mas
  // continua na lista (pratos que já usavam ela simplesmente deixam de
  // mostrá-la, sem apagar nada do prato). Ausente = ativa (default).
  active?: boolean;
}

export interface ExtraOption {
  id: string;
  name: string;
  price: number;
  maxQuantity?: number;
}

export interface ChoiceGroup {
  id: string;
  title: string;
  required: boolean;
  minChoices?: number;
  maxChoices?: number;
  options: {
    id: string;
    name: string;
    price: number;
  }[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  available: boolean;
  tags: DietaryTag[];
  preparationTimeMinutes?: number;
  servesCount?: number;
  calories?: number;
  choices?: ChoiceGroup[];
  extras?: ExtraOption[];
  allowSpecialNotes?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  // Imagem opcional (mostrada em vez do ícone/emoji em cardápios com layout
  // mais visual). URL de upload, igual às demais fotos do sistema.
  image?: string;
  // Categoria oculta não aparece no cardápio do cliente nem na navegação,
  // mas continua existindo (produtos dela não somem, só ficam sem uma seção
  // visível até a categoria voltar a ficar ativa). Ausente = ativa (default).
  active?: boolean;
}

export interface SelectedChoice {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface SelectedExtra {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  selectedChoices: SelectedChoice[];
  selectedExtras: SelectedExtra[];
  specialNotes?: string;
  unitPrice: number;
  totalPrice: number;
}

export type OrderType = 'delivery' | 'takeaway' | 'table';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'meal_voucher';
export type OrderStatus = 'recebido' | 'em_preparo' | 'saiu_entrega' | 'pronto' | 'entregue' | 'cancelado';

// Ajuste operacional em tempo real (Fase 4, itens 14-16) — o restaurante
// sinaliza "estamos mais devagar hoje" sem precisar recadastrar os tempos
// padrão de cada zona/faixa; o ajuste some assim que o restaurante volta ao
// normal (ajuste = 0), e os tempos padrão continuam intactos.
export type OperationalStatus = 'normal' | 'busy' | 'delayed';

export interface OperationalAdjustmentEntry {
  id: string;
  timestamp: string; // ISO
  previousMinutes: number;
  newMinutes: number;
  status: OperationalStatus;
  reason?: string;
}

export interface DeliveryZone {
  id: string;
  name?: string;
  neighborhood: string;
  fee: number;
  estimatedTime?: string;
  estimatedMinutes?: string;
  active?: boolean;
  minOrder?: number;
}

// Motor de cálculo de entrega (Fase 4, itens 9-13) — o restaurante escolhe
// COMO a taxa/tempo de entrega são calculados, sem perder o que já
// configurou. 'neighborhood' (bairro, o sistema de sempre) continua sendo o
// padrão quando `deliveryCalcMethod` está ausente — nada muda pra quem nunca
// mexer nisso.
export type DeliveryCalcMethod = 'neighborhood' | 'cep' | 'distance' | 'formula' | 'hybrid';

// Localização do próprio restaurante — usada como origem pro cálculo de
// distância (métodos 'distance'/'formula'/'hybrid'). Sem lat/lng aqui, esses
// métodos simplesmente não conseguem calcular (o motor cai pro próximo
// método configurado, ou informa que não foi possível calcular).
export interface RestaurantLocation {
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
}

// Método 1 (CEP): faixas de CEP com taxa própria, ex. 28890-000 a 28890-050.
export interface CepRange {
  id: string;
  cepStart: string; // 8 dígitos, sem traço
  cepEnd: string;
  label?: string;
  fee: number;
  estimatedMinutes?: string;
  active?: boolean;
}

// Método 3 (Distância): faixas de km com taxa e tempo (preparo + entrega
// separados — item 13) próprios, ex. 0-2km, 2-4km, 4-6km.
export interface DistanceTier {
  id: string;
  fromKm: number;
  toKm: number;
  fee: number;
  prepMinutes?: number;
  deliveryMinutes?: number;
  active?: boolean;
}

// Método 4 (Fórmula por distância): taxa-base + km incluído + adicional/km.
export interface DeliveryFormula {
  baseFee: number;
  includedKm: number;
  extraFeePerKm: number;
}

export interface DeliveryAddress {
  cep?: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state?: string;
  // Apto/Bloco/Casa/Sala — campo próprio, separado do Complemento livre
  // (Fase 4, item 7). Antes só existia "complement", misturando os dois.
  unit?: string;
  complement?: string;
  reference?: string;
  // Preenchidos por geocodificação best-effort a partir do CEP (Fase 4, item
  // 8) — ausentes quando a busca falha ou não roda; nunca bloqueiam o pedido.
  lat?: number;
  lng?: number;
}

// Conta permanente do cliente + endereços salvos (Fase 4, itens 20-22).
export interface CustomerAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 🏠 Casa / 🏢 Trabalho / 📍 Outro — mesmos campos do DeliveryAddress, mais
// um rótulo e um id próprio pra poder editar/excluir.
export interface SavedAddress extends DeliveryAddress {
  id: string;
  customerId: string;
  label: string;
  isDefault?: boolean;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate?: string;
  photo?: string;
  status?: 'available' | 'busy' | 'offline';
  rating?: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address?: DeliveryAddress;
  tableNumber?: string;
}

export interface Order {
  id: string;
  // Escopo explícito do pedido. O backend sempre preenche este campo com o
  // restaurante da rota; o cliente nunca escolhe esse valor.
  restaurantSlug?: string;
  orderNumber: number;
  createdAt: string;
  updatedAt?: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  orderType: OrderType;
  customer: OrderCustomer;
  // Preenchido pelo backend a partir do token de sessão quando o pedido é
  // feito por um cliente logado (Fase 4, itens 20-22) — nunca confiar num
  // valor vindo do próprio cliente sem validação de token.
  customerId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: 'pendente' | 'confirmado' | 'recusado' | 'reembolsado';
  paymentConfirmedAt?: string;
  cardBrand?: string;
  cashChangeFor?: number;
  status: OrderStatus;
  driver?: DriverInfo;
  estimatedMinutes?: number;
  cancelReason?: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  notes?: string;
}

// Os 10 estilos visuais que o restaurante pode escolher para a própria
// identidade (aplicado ao card dele na vitrine multi-restaurantes "/" e,
// futuramente, ao cabeçalho do próprio cardápio). Ver src/utils/layouts.ts
// para a definição visual de cada um.
export type LayoutId =
  | 'moderno-premium'
  | 'rustico-acolhedor'
  | 'clean-minimalista'
  | 'dark-elegante'
  | 'hero-food'
  | 'soft-moderno'
  | 'vibrante-food'
  | 'natural-organico'
  | 'neon-urbano'
  | 'galeria-gourmet';

// Uma foto da sequência de abertura (Splash), com ajuste individual de
// enquadramento. Substitui gradualmente o formato antigo (string[] de URLs) —
// ver normalizeSplashImage() em utils/helpers.ts, que aceita os dois formatos
// pra nunca quebrar restaurantes já cadastrados.
export interface SplashImageConfig {
  url: string;
  positionX?: number; // 0-100, posição horizontal do enquadramento (object-position)
  positionY?: number; // 0-100, posição vertical do enquadramento
  zoom?: number; // 100 = sem zoom, 100-200 = aproxima a imagem
  overlay?: number; // 0-100, escurecimento adicional sobre a foto
  text?: string; // legenda opcional exibida sobre a foto
  enabled?: boolean; // permite desativar uma foto sem removê-la da lista
}

export interface RestaurantConfig {
  // Ativo/inativo no super-admin (Fase 4) — injetado pelo backend a partir da
  // lista mestre de restaurantes, não é um campo editável nas Configurações
  // do próprio restaurante. Ausente/undefined é tratado como ativo (default).
  // Senhas específicas deste restaurante (evolução v24_2) — o backend nunca
  // devolve o hash, só esses booleanos indicando se já foi configurada.
  // Pra DEFINIR uma senha nova, o painel envia kanbanPassword/
  // historyClearPassword (texto puro, só na hora de salvar) — ver PUT /config.
  kanbanPasswordSet?: boolean;
  historyClearPasswordSet?: boolean;
  active?: boolean;
  name: string;
  tagline: string;
  logo: string;
  bannerImage: string;
  // Ajuste fino da capa (banner) — evita que a foto fique deformada ou corte
  // a parte importante da comida/identidade em telas de proporções diferentes.
  bannerPositionX?: number; // 0-100
  bannerPositionY?: number; // 0-100
  bannerZoom?: number; // 100-200
  bannerOverlay?: number; // 0-100
  bannerText?: string; // texto opcional sobreposto à capa (ex: chamada/promoção)
  // Identidade visual: cor principal e secundária do restaurante, usadas nos
  // cards da vitrine multi-restaurantes (nunca fixas/douradas por padrão).
  color?: string;
  secondaryColor?: string;
  // Estilo visual escolhido pelo restaurante entre os 10 disponíveis.
  layout?: LayoutId;
  // Tema "premium" do cardápio em si (fundo escuro, tipografia serifada,
  // animações suaves) — opcional, qualquer restaurante pode ligar em
  // Configurações → Aparência. Antes esse visual só existia hardcoded pro
  // restaurante de slug 'japones'; agora é uma opção de configuração como
  // qualquer outra, sem nenhum if/else amarrado a um nome de restaurante.
  premiumTheme?: boolean;
  phone: string;
  whatsapp: string;
  address: string;
  isOpen: boolean;
  openingHours: string;
  deliveryFee: number;
  freeDeliveryThreshold?: number;
  freeDeliveryEnabled?: boolean; // default true (compat) — desliga a promoção sem apagar o valor
  minimumOrder: number;
  estimatedDeliveryTime: string;
  deliveryZones: DeliveryZone[];
  // Motor de cálculo de entrega (Fase 4, itens 9-13) — todos opcionais e
  // aditivos: sem eles, o sistema funciona exatamente como sempre funcionou
  // (deliveryZones por bairro + deliveryFee/estimatedDeliveryTime padrão).
  restaurantLocation?: RestaurantLocation;
  deliveryCalcMethod?: DeliveryCalcMethod; // ausente = 'neighborhood' (comportamento de sempre)
  // Só usado quando deliveryCalcMethod === 'hybrid' — ordem em que os
  // métodos são tentados até um resolver o endereço. Ex: ['cep',
  // 'neighborhood', 'distance']. Ausente = essa ordem padrão.
  deliveryHybridPriority?: DeliveryCalcMethod[];
  cepRanges?: CepRange[];
  distanceTiers?: DistanceTier[];
  deliveryFormula?: DeliveryFormula;
  // Raio máximo de entrega em km — além dele, o endereço é recusado
  // ("fora da área de entrega") em vez de usar a primeira zona cadastrada
  // como fallback (item 12). Ausente = sem limite de raio.
  maxDeliveryRadiusKm?: number;
  // Ajuste operacional em tempo real (Fase 4, itens 14-16). Ausente =
  // 'normal' / +0min (comportamento de sempre, tempo padrão exibido puro).
  operationalStatus?: OperationalStatus;
  operationalAdjustmentMinutes?: number;
  // Histórico dos últimos ajustes — mais recente primeiro. Capado no
  // backend (ver backend/index.js) pra não crescer sem limite.
  operationalAdjustmentHistory?: OperationalAdjustmentEntry[];
  drivers: DriverInfo[];
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  instagram: string;
  allowTableOrders: boolean;
  totalTables: number;
  // Tela de abertura em tela cheia (fotos de pratos/ambiente/promoções) exibida
  // por alguns segundos antes do cardápio, estilo iFood/Uber Eats/Airbnb.
  splashEnabled?: boolean;
  // Aceita o formato novo (objetos com ajuste individual) e o antigo
  // (string[] de URLs) ao mesmo tempo — ver normalizeSplashImage().
  splashImages?: (string | SplashImageConfig)[];
  splashDurationSeconds?: number;
  // Configurações → Impressão: tamanho do papel da impressora térmica e
  // impressão automática de novos pedidos (a automação de fato — sem clique
  // manual — depende de driver/app da impressora do sistema operacional;
  // aqui só guardamos a preferência pra usar quando essa integração existir).
  printPaperWidth?: '58mm' | '80mm';
  printAutoNewOrders?: boolean;
  // Item pedido: banner de promoções acima do cardápio deixa de ter texto fixo
  // ("Entrega Rápida...", cupom BEMVINDO10) e vira uma lista configurável.
  // Sem essa lista (restaurantes antigos), o banner simplesmente não aparece —
  // nenhum texto fixo é mais mostrado por padrão.
  promoBadges?: PromoBadge[];
  // Biblioteca de badges/etiquetas de pratos deste restaurante (Fase 4, itens
  // 5/6) — ausente/undefined usa DEFAULT_BADGES (8 badges padrão) como
  // fallback, então restaurantes que nunca abriram essa tela continuam
  // exibindo os mesmos badges de sempre sem precisar de nenhuma migração.
  badges?: RestaurantBadge[];
}

export interface PromoBadge {
  id: string;
  icon?: string; // um emoji simples, opcional (ex: "🛵", "🎉")
  title: string;
  subtitle?: string;
  couponCode?: string; // opcional — se preenchido, mostra botão "Aplicar" ligado a um cupom já cadastrado
}
