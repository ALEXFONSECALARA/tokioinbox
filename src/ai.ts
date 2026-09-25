import { RestaurantSlug, MenuItem } from './restaurant';

export type AIProvider = 'gemini' | 'openai' | 'local_heuristic';

export interface AIRestaurantSettings {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  isActive: boolean;
  temperature: number;
  monthlyUsageLimit: number;
  currentUsageCount: number;
  restaurantInstructions: string;
  allowDiscountsSuggestion: boolean;
}

export interface AIChatMessage {
  id: string;
  sender: 'customer' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  suggestedProductIds?: string[];
  actionLink?: string;
}

export interface AISalesSuggestion {
  id: string;
  restaurantSlug: RestaurantSlug;
  title: string;
  category: 'combo' | 'adicional' | 'promocao' | 'destaque' | 'reativacao' | 'horario_fraco';
  reasoning: string;
  impactEstimate: string; // e.g. "+14% no ticket médio"
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'editado';
  createdAt: string;
  proposedAction: {
    type: 'create_promo' | 'create_combo' | 'highlight_item' | 'launch_campaign';
    couponCode?: string;
    discountPercent?: number;
    targetItemIds?: string[];
    minOrderValue?: number;
    description?: string;
    suggestedHours?: string;
  };
}
