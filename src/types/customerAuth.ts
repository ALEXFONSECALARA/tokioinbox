import { RestaurantSlug } from './restaurant';

export type CustomerLoginMode = 'GLOBAL' | 'PER_RESTAURANT';

export interface CustomerAddress {
  id: string;
  title: string;
  zipCode?: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state?: string;
  complement?: string;
  isDefault?: boolean;
}

export interface CustomerSession {
  id: string;
  name: string;
  phone: string;
  phoneNormalized?: string;
  email?: string;
  loginMode?: CustomerLoginMode;
  restaurantSlug?: RestaurantSlug;
  savedAddresses: CustomerAddress[];
  installedPwaAt?: string;
  hasClaimedInstallBonus: boolean;
  installBonusCouponCode?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface InstallationBonusConfig {
  enabled: boolean;
  rewardType: 'percent_discount' | 'fixed_discount' | 'free_delivery' | 'free_item';
  rewardValue: number; // e.g. 15 for 15% or 10 for R$ 10
  couponPrefix: string; // e.g. "BONUSPWA"
  minOrderValue: number;
  validityDays: number;
  applicableRestaurantSlug?: RestaurantSlug | 'all';
}
