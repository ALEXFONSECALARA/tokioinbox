import { RestaurantSlug } from './restaurant';

export type MarketingChannel =
  | 'instagram_post'
  | 'instagram_story'
  | 'whatsapp_broadcast'
  | 'facebook_post'
  | 'telegram_channel'
  | 'google_business'
  | 'pwa_push';

export type CampaignGoal =
  | 'lancamento'
  | 'promocao'
  | 'horario_fraco'
  | 'retorno_cliente'
  | 'aniversario'
  | 'carrinho_abandonado'
  | 'destaque_produto';

export interface MarketingContentDraft {
  id: string;
  restaurantSlug: RestaurantSlug;
  channel: MarketingChannel;
  goal: CampaignGoal;
  title: string;
  copyText: string;
  callToAction: string;
  hashtags: string[];
  suggestedImagePrompt: string;
  restaurantLink: string;
  qrCodeUrl?: string;
  status: 'rascunho' | 'aprovado' | 'publicado' | 'arquivado';
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface AIPromotionRule {
  id: string;
  restaurantSlug: RestaurantSlug | 'all';
  title: string;
  type:
    | 'percentual'
    | 'fixo'
    | 'frete_gratis'
    | 'complemento_gratis'
    | 'produto_gratis'
    | 'combo_especial';
  value: number;
  minOrderValue: number;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
  startTime?: string; // "14:00"
  endTime?: string; // "18:00"
  targetAudience: 'todos' | 'novos_clientes' | 'recorrentes' | 'inativos';
  maxTotalUses: number;
  currentUses: number;
  maxUsesPerCustomer: number;
  status: 'sugerida_ia' | 'ativa' | 'pausada' | 'expirada';
  couponCode: string;
  startDate: string;
  endDate: string;
}
