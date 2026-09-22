import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Order } from './orderService';
import type { CustomerRecord } from './customerAuthService';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

export function getSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL || null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (err) {
    console.error('[Supabase] Erro ao inicializar client:', err);
    return null;
  }
}

/**
 * Health check & diagnostic for Supabase connection.
 */
export async function testSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url: string | null;
  message: string;
  tables?: {
    customers: boolean;
    orders: boolean;
  };
}> {
  const configured = isSupabaseConfigured();
  const url = getSupabaseUrl();

  if (!configured) {
    return {
      configured: false,
      connected: false,
      url: null,
      message: 'Supabase não configurado (SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no ambiente).',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      message: 'Falha ao inicializar o cliente Supabase.',
    };
  }

  const tablesStatus = {
    customers: false,
    orders: false,
  };

  try {
    // Check customers table
    const { error: custErr } = await client.from('customers').select('id').limit(1);
    tablesStatus.customers = !custErr;

    // Check orders table
    const { error: ordErr } = await client.from('orders').select('id').limit(1);
    tablesStatus.orders = !ordErr;

    return {
      configured: true,
      connected: true,
      url,
      message: 'Conexão com Supabase estabelecida com sucesso.',
      tables: tablesStatus,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      url,
      message: `Erro ao conectar com Supabase: ${err.message || err}`,
      tables: tablesStatus,
    };
  }
}

/**
 * Syncs an order to Supabase orders table (non-blocking, graceful fallback).
 */
export async function syncOrderToSupabase(order: Order): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não inicializado' };

  try {
    const payload = {
      id: order.id,
      short_code: order.shortCode,
      restaurant_id: order.restaurantSlug,
      customer_id: order.customerId || null,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_phone_normalized: order.customerPhoneNormalized || order.customerPhone.replace(/\D/g, ''),
      order_type: order.orderType,
      table_number: order.tableNumber || null,
      pickup_number: order.pickupNumber || null,
      delivery_address: order.deliveryAddress ? JSON.stringify(order.deliveryAddress) : null,
      items: JSON.stringify(order.items),
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      discount: order.discount,
      coupon_code: order.couponCode || null,
      total: order.total,
      payment_method: order.paymentMethod,
      payment_details: order.paymentDetails ? JSON.stringify(order.paymentDetails) : null,
      notes: order.notes || null,
      status: order.status,
      status_history: JSON.stringify(order.statusHistory || []),
      print_status: order.printStatus || 'pendente',
      idempotency_key: order.idempotencyKey || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('orders')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase Sync Order Warning]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase Sync Order Exception]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Syncs a customer record to Supabase customers table.
 */
export async function syncCustomerToSupabase(customer: CustomerRecord): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não inicializado' };

  try {
    const { error } = await client
      .from('customers')
      .upsert({
        id: customer.id,
        name: customer.name,
        raw_phone: customer.phone,
        phone_normalized: customer.phoneNormalized,
        password_hash: customer.passwordHash,
        password_salt: customer.passwordSalt,
        updated_at: customer.updatedAt || new Date().toISOString(),
        last_login_at: customer.lastLoginAt || null,
      }, { onConflict: 'phone_normalized' });

    if (error) {
      console.warn('[Supabase Sync Customer Warning]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase Sync Customer Exception]:', err.message);
    return { success: false, error: err.message };
  }
}
