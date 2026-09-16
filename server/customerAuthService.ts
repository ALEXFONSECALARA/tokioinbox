import { CustomerLoginMode, CustomerSession, InstallationBonusConfig } from '../src/types/customerAuth';

let currentLoginMode: CustomerLoginMode = 'GLOBAL';

let installationBonusConfig: InstallationBonusConfig = {
  enabled: true,
  rewardType: 'percent_discount',
  rewardValue: 15,
  couponPrefix: 'AURAAPP15',
  minOrderValue: 40,
  validityDays: 14,
  applicableRestaurantSlug: 'all',
};

// Registered customer sessions
let customerSessions: CustomerSession[] = [
  {
    id: 'cust-demo-1',
    name: 'Carolina Mendes',
    phone: '(11) 98888-7711',
    email: 'carolina.mendes@email.com',
    loginMode: 'GLOBAL',
    savedAddresses: [
      {
        id: 'addr-1',
        title: 'Casa',
        street: 'Av. Paulista',
        number: '1500',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        complement: 'Apto 42',
        isDefault: true,
      },
    ],
    hasClaimedInstallBonus: false,
    createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString(),
    lastLoginAt: new Date().toISOString(),
  },
];

// Set of phones that already claimed the bonus
const claimedBonusPhones = new Set<string>();

export function getCustomerLoginMode(): CustomerLoginMode {
  return currentLoginMode;
}

export function setCustomerLoginMode(mode: CustomerLoginMode): CustomerLoginMode {
  currentLoginMode = mode;
  return currentLoginMode;
}

export function getInstallationBonusConfig(): InstallationBonusConfig {
  return installationBonusConfig;
}

export function updateInstallationBonusConfig(updates: Partial<InstallationBonusConfig>): InstallationBonusConfig {
  installationBonusConfig = { ...installationBonusConfig, ...updates };
  return installationBonusConfig;
}

export function authenticateCustomer(params: {
  phone: string;
  name?: string;
  restaurantSlug?: string;
}): { customer: CustomerSession; isNew: boolean } {
  const cleanPhone = params.phone.replace(/\D/g, '');
  let customer = customerSessions.find((c) => c.phone.replace(/\D/g, '') === cleanPhone);
  let isNew = false;

  if (!customer) {
    isNew = true;
    customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: params.name || 'Cliente Aura',
      phone: params.phone,
      loginMode: currentLoginMode,
      restaurantSlug: currentLoginMode === 'PER_RESTAURANT' ? params.restaurantSlug : undefined,
      savedAddresses: [],
      hasClaimedInstallBonus: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    customerSessions.push(customer);
  } else {
    customer.lastLoginAt = new Date().toISOString();
    if (params.name && customer.name === 'Cliente Aura') {
      customer.name = params.name;
    }
  }

  return { customer, isNew };
}

/**
 * Claim installation bonus with backend anti-fraud validation
 */
export function claimInstallationBonus(customerId: string, phone: string): {
  success: boolean;
  couponCode?: string;
  message: string;
} {
  const cleanPhone = phone.replace(/\D/g, '');

  if (!installationBonusConfig.enabled) {
    return { success: false, message: 'Bônus de instalação inativo no momento.' };
  }

  if (claimedBonusPhones.has(cleanPhone)) {
    return {
      success: false,
      message: 'Este número já resgatou o bônus de instalação anteriormente.',
    };
  }

  const customer = customerSessions.find((c) => c.id === customerId);
  if (customer && customer.hasClaimedInstallBonus) {
    return {
      success: false,
      message: 'Bônus já resgatado nesta conta.',
    };
  }

  const couponCode = `${installationBonusConfig.couponPrefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  claimedBonusPhones.add(cleanPhone);

  if (customer) {
    customer.hasClaimedInstallBonus = true;
    customer.installBonusCouponCode = couponCode;
    customer.installedPwaAt = new Date().toISOString();
  }

  return {
    success: true,
    couponCode,
    message: `Parabéns! Você ganhou ${installationBonusConfig.rewardValue}% de desconto com o cupom ${couponCode}!`,
  };
}
