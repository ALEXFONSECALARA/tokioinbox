// Importa os dados hoje em server/data/restaurants/*.json para o Supabase.
//
// Segue exatamente a estratégia da seção 49 do prompt mestre:
//   BACKUP → MIGRAÇÃO → VALIDAÇÃO → Supabase como fonte principal
//                                    (JSON continua no disco como fallback,
//                                     nada é apagado por este script)
//
// Como rodar:
//   1. Configure no seu .env (ou exporte no terminal):
//        SUPABASE_URL=https://ojztmcnghgsrvstmasnc.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<a chave service_role, NUNCA a anon>
//   2. Rode as duas migrações SQL no Supabase (SQL Editor ou CLI):
//        supabase/migrations/0001_init_schema.sql
//        supabase/migrations/0002_rls_policies.sql
//   3. node scripts/migrate-to-supabase.mjs
//
// O script é IDEMPOTENTE: pode rodar de novo com segurança (usa upsert por
// slug/id) — rodar duas vezes não duplica restaurante nem pedido.
//
// Ele NÃO apaga server/data/. Depois de migrar e validar (passo de
// verificação ao final do script + testar o app manualmente com
// SUPABASE_URL configurado), os arquivos JSON continuam ali como cópia de
// segurança até vocês decidirem removê-los — decisão deliberada, não
// automática, como pede a seção 49.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'server', 'data');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar este script.');
  console.error('   Ex: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-to-supabase.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readJson(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// ---------- 1. BACKUP ----------
function backupDataDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(ROOT, 'server', `data-backup-${stamp}`);
  cpSync(DATA_DIR, backupDir, { recursive: true });
  console.log(`✅ Backup criado em: server/data-backup-${stamp}/`);
  return backupDir;
}

// ---------- 2. MIGRAÇÃO ----------
async function migrateRestaurant(reg) {
  const { slug, name, emoji, color } = reg;
  console.log(`\n▶ Migrando "${slug}" (${name})...`);

  const { data: restaurantRow, error: upsertErr } = await supabase
    .from('restaurants')
    .upsert({ slug, name, emoji, color }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (upsertErr) throw upsertErr;
  const restaurantId = restaurantRow.id;

  const configJson = readJson(path.join(DATA_DIR, 'restaurants', slug, 'config.json'), null);
  if (configJson) {
    const configRow = {
      restaurant_id: restaurantId,
      tagline: configJson.tagline,
      logo: configJson.logo,
      banner_image: configJson.bannerImage,
      phone: configJson.phone,
      whatsapp: configJson.whatsapp,
      address: configJson.address,
      is_open: configJson.isOpen,
      opening_hours: configJson.openingHours,
      delivery_fee: configJson.deliveryFee ?? 0,
      free_delivery_threshold: configJson.freeDeliveryThreshold ?? null,
      minimum_order: configJson.minimumOrder ?? 0,
      estimated_delivery_time: configJson.estimatedDeliveryTime,
      delivery_zones: configJson.deliveryZones || [],
      drivers: configJson.drivers || [],
      pix_key: configJson.pixKey,
      pix_key_type: configJson.pixKeyType,
      instagram: configJson.instagram,
      allow_table_orders: !!configJson.allowTableOrders,
      total_tables: configJson.totalTables ?? 0,
      splash_enabled: !!configJson.splashEnabled,
      splash_images: configJson.splashImages || [],
      splash_duration_seconds: configJson.splashDurationSeconds ?? null,
      print_paper_width: configJson.printPaperWidth || '80mm',
      print_auto_new_orders: !!configJson.printAutoNewOrders,
    };
    const { error } = await supabase.from('restaurant_configs').upsert(configRow, { onConflict: 'restaurant_id' });
    if (error) throw error;
    console.log('  ✅ config.json → restaurant_configs');
  } else {
    console.log('  ⚠️  config.json não encontrado — pulado.');
  }

  const menuJson = readJson(path.join(DATA_DIR, 'restaurants', slug, 'menu.json'), { menuItems: [], categories: [] });

  const categoryRows = (menuJson.categories || []).map((cat, idx) => ({
    restaurant_id: restaurantId,
    id: cat.id,
    name: cat.name,
    icon: cat.icon || null,
    description: cat.description || null,
    sort_order: idx,
  }));
  if (categoryRows.length > 0) {
    const { error } = await supabase.from('menu_categories').upsert(categoryRows, { onConflict: 'restaurant_id,id' });
    if (error) throw error;
  }
  console.log(`  ✅ ${categoryRows.length} categorias → menu_categories`);

  const itemRows = (menuJson.menuItems || []).map((item, idx) => ({
    restaurant_id: restaurantId,
    id: item.id,
    category_id: item.categoryId,
    name: item.name,
    description: item.description || '',
    price: item.price,
    original_price: item.originalPrice ?? null,
    image: item.image || '',
    available: item.available !== false,
    tags: item.tags || [],
    preparation_time_minutes: item.preparationTimeMinutes ?? null,
    serves_count: item.servesCount ?? null,
    calories: item.calories ?? null,
    choices: item.choices || [],
    extras: item.extras || [],
    allow_special_notes: !!item.allowSpecialNotes,
    sort_order: idx,
  }));
  if (itemRows.length > 0) {
    const { error } = await supabase.from('menu_items').upsert(itemRows, { onConflict: 'restaurant_id,id' });
    if (error) throw error;
  }
  console.log(`  ✅ ${itemRows.length} itens de cardápio → menu_items`);

  const ordersJson = readJson(path.join(DATA_DIR, 'restaurants', slug, 'orders.json'), []);
  let migratedOrders = 0;
  for (const order of ordersJson) {
    const orderRow = {
      id: order.id,
      restaurant_id: restaurantId,
      order_number: order.orderNumber,
      order_type: order.orderType,
      status: order.status || 'recebido',
      customer: order.customer || {},
      subtotal: order.subtotal ?? 0,
      delivery_fee: order.deliveryFee ?? 0,
      discount: order.discount ?? 0,
      coupon_code: order.couponCode ?? null,
      total: order.total ?? 0,
      payment_method: order.paymentMethod,
      card_brand: order.cardBrand ?? null,
      cash_change_for: order.cashChangeFor ?? null,
      driver: order.driver ?? null,
      estimated_minutes: order.estimatedMinutes ?? null,
      cancel_reason: order.cancelReason ?? null,
      notes: order.notes ?? null,
      status_history: order.statusHistory || [],
      created_at: order.createdAt || new Date().toISOString(),
    };
    const { error } = await supabase.from('orders').upsert(orderRow, { onConflict: 'id' });
    if (error) throw error;

    const itemRowsForOrder = (order.items || []).map((it, idx) => ({
      order_id: order.id,
      id: it.id,
      restaurant_id: restaurantId,
      menu_item_id: it.menuItem?.id ?? null,
      name: it.menuItem?.name || '',
      category_id: it.menuItem?.categoryId ?? null,
      sector: null,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total_price: it.totalPrice,
      selected_choices: it.selectedChoices || [],
      selected_extras: it.selectedExtras || [],
      special_notes: it.specialNotes ?? null,
      menu_item_snapshot: it.menuItem || {},
      sort_order: idx,
    }));
    if (itemRowsForOrder.length > 0) {
      const { error: itemsErr } = await supabase.from('order_items').upsert(itemRowsForOrder, { onConflict: 'order_id,id' });
      if (itemsErr) throw itemsErr;
    }
    migratedOrders += 1;
  }
  console.log(`  ✅ ${migratedOrders} pedidos → orders/order_items`);

  return { slug, categories: categoryRows.length, items: itemRows.length, orders: migratedOrders };
}

// ---------- 3. VALIDAÇÃO ----------
async function validate(registrations) {
  console.log('\n🔍 Validando (comparando contagens JSON vs Supabase)...');
  let allOk = true;
  for (const reg of registrations) {
    const menuJson = readJson(path.join(DATA_DIR, 'restaurants', reg.slug, 'menu.json'), { menuItems: [], categories: [] });
    const ordersJson = readJson(path.join(DATA_DIR, 'restaurants', reg.slug, 'orders.json'), []);

    const { data: restaurantRow } = await supabase.from('restaurants').select('id').eq('slug', reg.slug).single();
    const { count: itemCount } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantRow.id);
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantRow.id);

    const itemsOk = itemCount === (menuJson.menuItems || []).length;
    const ordersOk = orderCount === ordersJson.length;
    if (!itemsOk || !ordersOk) allOk = false;
    console.log(
      `  ${itemsOk && ordersOk ? '✅' : '❌'} ${reg.slug}: itens ${itemCount}/${(menuJson.menuItems || []).length}, pedidos ${orderCount}/${ordersJson.length}`
    );
  }
  return allOk;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log(' TokioInbox → Migração para Supabase (Fase 2)');
  console.log('═══════════════════════════════════════════');

  backupDataDir();

  const registrations = readJson(path.join(DATA_DIR, 'restaurants.json'), []);
  if (registrations.length === 0) {
    console.log('⚠️  server/data/restaurants.json está vazio — nada para migrar.');
    return;
  }

  for (const reg of registrations) {
    await migrateRestaurant(reg);
  }

  const ok = await validate(registrations);

  console.log('\n═══════════════════════════════════════════');
  if (ok) {
    console.log('✅ Migração concluída e validada. Contagens batem em todos os restaurantes.');
    console.log('   Próximo passo: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Render');
    console.log('   e reinicie o serviço — o backend passa a usar o Supabase automaticamente.');
    console.log('   server/data/ continua intacto no disco como cópia de segurança.');
  } else {
    console.log('❌ Alguma contagem não bateu — revise os logs acima antes de apontar o Render pro Supabase.');
    process.exitCode = 1;
  }
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Erro na migração:', err);
  process.exitCode = 1;
});
