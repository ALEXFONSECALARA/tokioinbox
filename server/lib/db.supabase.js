// Backend de dados no Supabase — mesma interface pública de db.json.js,
// pra server/lib/db.js poder trocar de um pro outro sem o resto do server/
// (nem o frontend) perceber diferença nenhuma na resposta das rotas.
//
// Isolamento entre restaurantes (seção 47/48 do prompt mestre): toda função
// aqui recebe SEMPRE o `slug` (nunca um restaurant_id vindo do cliente).
// resolveRestaurantId() é a ÚNICA porta de entrada pra descobrir o
// restaurant_id, e ele SEMPRE busca no banco pelo slug — nunca confia em um
// id que tenha vindo solto do corpo da requisição. Isso é reforçado pelas
// políticas de RLS em 0002_rls_policies.sql, mas o isolamento real, hoje,
// vem daqui: nenhuma query abaixo aceita restaurant_id vindo de fora.
import { supabase } from './supabaseClient.js';

const restaurantIdCache = new Map(); // slug -> uuid (dado imutável, seguro cachear em memória)

async function resolveRestaurantId(slug) {
  if (restaurantIdCache.has(slug)) return restaurantIdCache.get(slug);
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  restaurantIdCache.set(slug, data.id);
  return data.id;
}

// ---------- mapeadores camelCase (API) <-> snake_case (Postgres) ----------

function configRowToApi(restaurantRow, configRow) {
  if (!configRow) return null;
  return {
    name: restaurantRow?.name,
    tagline: configRow.tagline,
    logo: configRow.logo,
    bannerImage: configRow.banner_image,
    bannerPositionX: configRow.banner_position_x ?? undefined,
    bannerPositionY: configRow.banner_position_y ?? undefined,
    bannerZoom: configRow.banner_zoom ?? undefined,
    bannerOverlay: configRow.banner_overlay ?? undefined,
    bannerText: configRow.banner_text ?? undefined,
    color: configRow.color || restaurantRow?.color,
    secondaryColor: configRow.secondary_color ?? undefined,
    layout: configRow.layout ?? undefined,
    // Ativo/inativo mora na tabela `restaurants` (lista mestre), não em
    // restaurant_configs — restaurante sem o campo (linha antiga) é ativo.
    active: restaurantRow?.active !== false,
    phone: configRow.phone,
    whatsapp: configRow.whatsapp,
    address: configRow.address,
    isOpen: configRow.is_open,
    openingHours: configRow.opening_hours,
    deliveryFee: Number(configRow.delivery_fee),
    freeDeliveryThreshold:
      configRow.free_delivery_threshold != null ? Number(configRow.free_delivery_threshold) : undefined,
    freeDeliveryEnabled: configRow.free_delivery_enabled ?? undefined,
    minimumOrder: Number(configRow.minimum_order),
    estimatedDeliveryTime: configRow.estimated_delivery_time,
    deliveryZones: configRow.delivery_zones || [],
    drivers: configRow.drivers || [],
    promoBadges: configRow.promo_badges || [],
    badges: configRow.badges || [],
    pixKey: configRow.pix_key,
    pixKeyType: configRow.pix_key_type,
    instagram: configRow.instagram,
    allowTableOrders: configRow.allow_table_orders,
    totalTables: configRow.total_tables,
    splashEnabled: configRow.splash_enabled,
    splashImages: configRow.splash_images || [],
    splashDurationSeconds: configRow.splash_duration_seconds ?? undefined,
    printPaperWidth: configRow.print_paper_width,
    printAutoNewOrders: configRow.print_auto_new_orders,
    // Motor de cálculo de entrega (Fase 4, itens 9-13)
    restaurantLocation: configRow.restaurant_location || undefined,
    deliveryCalcMethod: configRow.delivery_calc_method || undefined,
    deliveryHybridPriority: configRow.delivery_hybrid_priority || undefined,
    cepRanges: configRow.cep_ranges || [],
    distanceTiers: configRow.distance_tiers || [],
    deliveryFormula: configRow.delivery_formula || undefined,
    maxDeliveryRadiusKm: configRow.max_delivery_radius_km != null ? Number(configRow.max_delivery_radius_km) : undefined,
    // Ajuste operacional em tempo real (Fase 4, itens 14-16)
    operationalStatus: configRow.operational_status || undefined,
    operationalAdjustmentMinutes: configRow.operational_adjustment_minutes != null ? Number(configRow.operational_adjustment_minutes) : undefined,
    operationalAdjustmentHistory: configRow.operational_adjustment_history || [],
  };
}

function configApiToRow(incoming) {
  const row = {};
  const map = {
    tagline: 'tagline',
    logo: 'logo',
    bannerImage: 'banner_image',
    bannerPositionX: 'banner_position_x',
    bannerPositionY: 'banner_position_y',
    bannerZoom: 'banner_zoom',
    bannerOverlay: 'banner_overlay',
    bannerText: 'banner_text',
    color: 'color',
    secondaryColor: 'secondary_color',
    layout: 'layout',
    phone: 'phone',
    whatsapp: 'whatsapp',
    address: 'address',
    isOpen: 'is_open',
    openingHours: 'opening_hours',
    deliveryFee: 'delivery_fee',
    freeDeliveryThreshold: 'free_delivery_threshold',
    freeDeliveryEnabled: 'free_delivery_enabled',
    minimumOrder: 'minimum_order',
    estimatedDeliveryTime: 'estimated_delivery_time',
    deliveryZones: 'delivery_zones',
    drivers: 'drivers',
    promoBadges: 'promo_badges',
    badges: 'badges',
    pixKey: 'pix_key',
    pixKeyType: 'pix_key_type',
    instagram: 'instagram',
    allowTableOrders: 'allow_table_orders',
    totalTables: 'total_tables',
    splashEnabled: 'splash_enabled',
    splashImages: 'splash_images',
    splashDurationSeconds: 'splash_duration_seconds',
    printPaperWidth: 'print_paper_width',
    printAutoNewOrders: 'print_auto_new_orders',
    // Motor de cálculo de entrega (Fase 4, itens 9-13)
    restaurantLocation: 'restaurant_location',
    deliveryCalcMethod: 'delivery_calc_method',
    deliveryHybridPriority: 'delivery_hybrid_priority',
    cepRanges: 'cep_ranges',
    distanceTiers: 'distance_tiers',
    deliveryFormula: 'delivery_formula',
    maxDeliveryRadiusKm: 'max_delivery_radius_km',
    operationalStatus: 'operational_status',
    operationalAdjustmentMinutes: 'operational_adjustment_minutes',
    operationalAdjustmentHistory: 'operational_adjustment_history',
  };
  for (const [apiKey, col] of Object.entries(map)) {
    if (incoming[apiKey] !== undefined) row[col] = incoming[apiKey];
  }
  return row;
}

function categoryRowToApi(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || undefined,
    description: row.description || undefined,
    image: row.image || undefined,
    active: row.active !== false,
  };
}

function menuItemRowToApi(row) {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    description: row.description || '',
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    image: row.image || '',
    available: row.available,
    tags: row.tags || [],
    preparationTimeMinutes: row.preparation_time_minutes ?? undefined,
    servesCount: row.serves_count ?? undefined,
    calories: row.calories ?? undefined,
    choices: row.choices || undefined,
    extras: row.extras || undefined,
    allowSpecialNotes: row.allow_special_notes,
  };
}

function menuItemApiToRow(restaurantId, item, sortOrder) {
  return {
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
    // sector fica de fora de propósito nesta fase: sem UI/admin ainda pra
    // definir setor por produto (isso é Fase 3 — impressão por setor).
    // A coluna já tem default 'cozinha' no banco.
    sort_order: sortOrder,
  };
}

function orderRowToApi(orderRow, itemRows, restaurantSlug = undefined) {
  return {
    id: orderRow.id,
    restaurantSlug,
    orderNumber: orderRow.order_number,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at || orderRow.created_at,
    items: (itemRows || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it) => ({
        id: it.id,
        menuItem: it.menu_item_snapshot,
        quantity: it.quantity,
        selectedChoices: it.selected_choices || [],
        selectedExtras: it.selected_extras || [],
        specialNotes: it.special_notes || undefined,
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.total_price),
      })),
    subtotal: Number(orderRow.subtotal),
    deliveryFee: Number(orderRow.delivery_fee),
    discount: Number(orderRow.discount),
    couponCode: orderRow.coupon_code || undefined,
    total: Number(orderRow.total),
    orderType: orderRow.order_type,
    customer: orderRow.customer,
    customerId: orderRow.customer_id ?? undefined,
    paymentMethod: orderRow.payment_method,
    paymentStatus: orderRow.payment_status || 'pendente',
    paymentConfirmedAt: orderRow.payment_confirmed_at || undefined,
    cardBrand: orderRow.card_brand || undefined,
    cashChangeFor: orderRow.cash_change_for != null ? Number(orderRow.cash_change_for) : undefined,
    status: orderRow.status,
    driver: orderRow.driver || undefined,
    estimatedMinutes: orderRow.estimated_minutes ?? undefined,
    cancelReason: orderRow.cancel_reason || undefined,
    statusHistory: orderRow.status_history || [],
    notes: orderRow.notes || undefined,
  };
}

// ---------- interface pública (espelha db.json.js) ----------

function restaurantRowToSummary(r) {
  const cfg = Array.isArray(r.restaurant_configs) ? r.restaurant_configs[0] : r.restaurant_configs;
  return {
    slug: r.slug,
    publicSlug: String(r.name || r.slug).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'') || r.slug,
    name: r.name,
    emoji: r.emoji,
    color: cfg?.color || r.color,
    secondaryColor: cfg?.secondary_color ?? undefined,
    tagline: cfg?.tagline ?? undefined,
    logo: cfg?.logo ?? undefined,
    bannerImage: cfg?.banner_image ?? undefined,
    bannerPositionX: cfg?.banner_position_x ?? undefined,
    bannerPositionY: cfg?.banner_position_y ?? undefined,
    bannerZoom: cfg?.banner_zoom ?? undefined,
    layout: cfg?.layout ?? undefined,
    active: r.active !== false,
  };
}

const RESTAURANT_SUMMARY_SELECT =
  'slug, name, emoji, color, active, restaurant_configs(tagline, logo, banner_image, banner_position_x, banner_position_y, banner_zoom, color, secondary_color, layout)';

export async function getRestaurants() {
  // Uma única query (embed via FK restaurant_configs.restaurant_id ->
  // restaurants.id) já traz tudo que a vitrine "/" precisa — nada de N+1
  // nem de carregar cardápio/pedidos, só os campos de identidade visual.
  // Vitrine pública: só restaurantes ativos (getRestaurantsAdmin traz todos).
  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_SUMMARY_SELECT)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(restaurantRowToSummary);
}

export async function getRestaurantsAdmin() {
  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_SUMMARY_SELECT)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(restaurantRowToSummary);
}

export async function setRestaurantActive(slug, active) {
  const { data, error } = await supabase
    .from('restaurants')
    .update({ active: !!active })
    .eq('slug', slug)
    .select(RESTAURANT_SUMMARY_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? restaurantRowToSummary(data) : null;
}

export async function restaurantExists(slug) {
  return (await resolveRestaurantId(slug)) !== null;
}

export async function restaurantIsActive(slug) {
  const { data, error } = await supabase.from('restaurants').select('active').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return data.active !== false;
}

export async function readRestaurantData(slug) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return { menuItems: [], categories: [], restaurantConfig: null };

  const [{ data: restaurantRow }, { data: configRow }, { data: categoryRows, error: catErr }, { data: itemRows, error: itemErr }] =
    await Promise.all([
      supabase.from('restaurants').select('*').eq('id', restaurantId).maybeSingle(),
      supabase.from('restaurant_configs').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ]);
  if (catErr) throw catErr;
  if (itemErr) throw itemErr;

  return {
    menuItems: (itemRows || []).map(menuItemRowToApi),
    categories: (categoryRows || []).map(categoryRowToApi),
    restaurantConfig: configRowToApi(restaurantRow, configRow),
  };
}

export async function listOrders(slug) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return [];
  const { data: orderRows, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!orderRows || orderRows.length === 0) return [];

  const { data: itemRows, error: itemErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('order_id', orderRows.map((o) => o.id));
  if (itemErr) throw itemErr;

  const itemsByOrder = new Map();
  for (const it of itemRows || []) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }
  return orderRows.map((o) => orderRowToApi(o, itemsByOrder.get(o.id), slug));
}

export async function getOrder(slug, id) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return null;
  const { data: orderRow, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!orderRow) return null;
  const { data: itemRows, error: itemErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id);
  if (itemErr) throw itemErr;
  return orderRowToApi(orderRow, itemRows, slug);
}

export async function createOrder(slug, order) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) throw new Error(`Restaurante "${slug}" não encontrado.`);

  const orderRow = {
    id: order.id,
    restaurant_id: restaurantId,
    order_number: Number(order.orderNumber),
    order_type: order.orderType,
    status: order.status || 'recebido',
    customer: order.customer || {},
    customer_id: order.customerId ?? null,
    subtotal: Number(order.subtotal) || 0,
    delivery_fee: Number(order.deliveryFee) || 0,
    discount: Number(order.discount) || 0,
    coupon_code: order.couponCode ?? null,
    total: Number(order.total) || 0,
    payment_method: order.paymentMethod ?? null,
    payment_status: order.paymentStatus ?? 'pendente',
    payment_confirmed_at: order.paymentConfirmedAt ?? null,
    card_brand: order.cardBrand ?? null,
    cash_change_for: order.cashChangeFor ?? null,
    driver: order.driver ?? null,
    estimated_minutes: order.estimatedMinutes ?? null,
    cancel_reason: order.cancelReason ?? null,
    notes: order.notes ?? null,
    status_history: order.statusHistory || [],
    created_at: order.createdAt || new Date().toISOString(),
  };

  const itemRows = (order.items || []).map((item, idx) => ({
    order_id: order.id,
    id: item.id || `${order.id}-item-${idx}`,
    restaurant_id: restaurantId,
    menu_item_id: item.menuItem?.id ?? null,
    name: item.menuItem?.name || '',
    category_id: item.menuItem?.categoryId ?? null,
    sector: item.menuItem?.sector ?? null,
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unitPrice) || 0,
    total_price: Number(item.totalPrice) || 0,
    selected_choices: item.selectedChoices || [],
    selected_extras: item.selectedExtras || [],
    special_notes: item.specialNotes ?? null,
    menu_item_snapshot: item.menuItem || {},
    sort_order: idx,
  }));

  // Prefer the transactional RPC. This prevents the dangerous V21 failure mode
  // where the order row is committed but order_items fails, leaving a broken
  // order that the client sees as "erro" and retries.
  const { error: rpcErr } = await supabase.rpc('create_order_atomic', {
    p_order: orderRow,
    p_items: itemRows,
  });

  if (!rpcErr) return await getOrder(slug, order.id);

  // During rollout, allow the app to keep working against a database that has
  // not received 0022 yet. If the function is missing OR the function is
  // present but PostgreSQL/PostgREST still has an incomplete schema cache, use
  // a guarded fallback. The fallback also removes only the columns that the
  // live schema explicitly says it does not know, so one pending migration
  // does not make the entire checkout unusable.
  const rpcMessage = String(rpcErr.message || '');
  // PostgREST can keep an old schema cache for a short period after the SQL
  // migration. In that case the function exists in PostgreSQL but the API
  // returns PGRST202 / 'Could not find the function'. Treat that exactly like
  // a missing RPC and use the guarded fallback below. This is critical during
  // Render deploys because otherwise the customer sees a generic checkout
  // failure even though the normal orders/order_items tables are healthy.
  const rpcMissing = ['42883', 'PGRST202', 'PGRST204'].includes(String(rpcErr.code || '')) ||
    /create_order_atomic.*does not exist|could not find the function|could not find the '.*' column|column .* does not exist/i.test(rpcMessage);
  if (!rpcMissing) {
    if (rpcErr.code === '23505') return await getOrder(slug, order.id);
    throw rpcErr;
  }

  const removeMissingColumn = (row, err) => {
    const code = String(err?.code || '');
    const message = String(err?.message || '');
    if (!['42703', 'PGRST204'].includes(code)) return null;
    const match =
      message.match(/Could not find the '([a-z_]+)' column/i) ||
      message.match(/column [\"']?([a-z_]+)[\"']? (?:of .* )?does not exist/i);
    return match ? match[1] : null;
  };

  const insertOrderResilient = async (initialRow) => {
    let row = { ...initialRow };
    for (let attempt = 0; attempt < 16; attempt++) {
      const { error: insertErr } = await supabase.from('orders').insert(row);
      if (!insertErr) return { duplicate: false };
      if (insertErr.code === '23505') return { duplicate: true };
      const missingColumn = removeMissingColumn(row, insertErr);
      if (!missingColumn || !(missingColumn in row)) throw insertErr;
      console.warn(`[checkout-schema-fallback] orders.${missingColumn} não está disponível no schema/cache do Supabase; continuando sem esse campo.`);
      delete row[missingColumn];
    }
    throw new Error('Não foi possível persistir o pedido: schema do Supabase incompatível.');
  };

  const insertItemsResilient = async (rows) => {
    if (!rows.length) return;
    let current = rows.map((row) => ({ ...row }));
    for (let attempt = 0; attempt < 16; attempt++) {
      const { error: itemsErr } = await supabase.from('order_items').insert(current);
      if (!itemsErr) return;
      const missingColumn = removeMissingColumn(current[0] || {}, itemsErr);
      if (!missingColumn || !(missingColumn in (current[0] || {}))) throw itemsErr;
      console.warn(`[checkout-schema-fallback] order_items.${missingColumn} não está disponível no schema/cache do Supabase; continuando sem esse campo.`);
      current = current.map((row) => { const next = { ...row }; delete next[missingColumn]; return next; });
    }
    throw new Error('Não foi possível persistir os itens do pedido: schema do Supabase incompatível.');
  };

  try {
    const orderInsertResult = await insertOrderResilient(orderRow);
    // Idempotent retry: the order already exists, so its items are already
    // persisted and must not be inserted a second time.
    if (orderInsertResult?.duplicate) return await getOrder(slug, order.id);
    await insertItemsResilient(itemRows);
  } catch (err) {
    await supabase.from('orders').delete().eq('restaurant_id', restaurantId).eq('id', order.id);
    throw err;
  }
  return await getOrder(slug, order.id);
}
export async function deleteOrder(slug, id) {
  const restaurantId = await resolveRestaurantId(slug); if (!restaurantId) return null;
  const existing = await getOrder(slug, id); if (!existing) return null;
  const { error } = await supabase.from('orders').delete().eq('restaurant_id', restaurantId).eq('id', id); if (error) throw error; return existing;
}
export async function clearFinishedOrders(slug) {
  const restaurantId = await resolveRestaurantId(slug); if (!restaurantId) return { removed: 0 };
  const { data, error } = await supabase.from('orders').delete().eq('restaurant_id', restaurantId).in('status',['entregue','cancelado']).select('id'); if (error) throw error; return { removed:(data||[]).length };
}

export async function updateOrder(slug, id, patch, expectedUpdatedAt) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return null;

  const row = {};
  const map = {
    status: 'status',
    driver: 'driver',
    estimatedMinutes: 'estimated_minutes',
    cancelReason: 'cancel_reason',
    statusHistory: 'status_history',
    paymentStatus: 'payment_status',
    paymentConfirmedAt: 'payment_confirmed_at',
    notes: 'notes',
  };
  for (const [apiKey, col] of Object.entries(map)) {
    if (patch[apiKey] !== undefined) row[col] = patch[apiKey];
  }
  if (patch.status && patch.status !== (await getOrder(slug, id))?.status && patch.statusHistory === undefined) {
    const currentForHistory = await getOrder(slug, id);
    if (currentForHistory) {
      row.status_history = [
        ...(Array.isArray(currentForHistory.statusHistory) ? currentForHistory.statusHistory : []),
        { status: patch.status, timestamp: new Date().toISOString(), note: patch.status === 'cancelado' ? (patch.cancelReason || 'Cancelado pelo restaurante') : undefined },
      ];
    }
  }
  if (Object.keys(row).length === 0) return getOrder(slug, id);

  let query = supabase.from('orders').update(row).eq('restaurant_id', restaurantId).eq('id', id);
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw error;
  if (!data) {
    const current = await getOrder(slug, id);
    if (!current) return null;
    const err = new Error(expectedUpdatedAt ? 'Pedido foi alterado em outro dispositivo.' : 'Pedido não encontrado.');
    err.code = expectedUpdatedAt ? 'ORDER_CONFLICT' : 'ORDER_NOT_FOUND';
    err.currentOrder = current;
    throw err;
  }

  const { data: itemRows, error: itemErr } = await supabase.from('order_items').select('*').eq('order_id', id);
  if (itemErr) throw itemErr;
  return orderRowToApi(data, itemRows, slug);
}

export async function updateMenuItems(slug, menuItems) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) throw new Error(`Restaurante "${slug}" não encontrado.`);

  // Substituição total (mesmo comportamento do JSON: PUT troca a lista
  // inteira) — apaga o que não existe mais na lista enviada e faz upsert do
  // resto, numa única transação lógica via RPC seria ideal, mas pra manter
  // isto simples e sem exigir uma function extra no banco, fazemos
  // delete-then-insert. O risco de uma falha no meio deixar o cardápio
  // parcialmente salvo é o mesmo trade-off que "PUT sobrescreve o arquivo
  // inteiro" já tinha no JSON — não é uma regressão.
  const rows = menuItems.map((item, idx) => menuItemApiToRow(restaurantId, item, idx));

  const { error: delErr } = await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
  if (delErr) throw delErr;
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('menu_items').insert(rows);
    if (insErr) throw insErr;
  }
  return menuItems;
}

export async function updateCategories(slug, categories) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) throw new Error(`Restaurante "${slug}" não encontrado.`);

  const rows = categories.map((cat, idx) => ({
    restaurant_id: restaurantId,
    id: cat.id,
    name: cat.name,
    icon: cat.icon || null,
    description: cat.description || null,
    image: cat.image || null,
    active: cat.active !== false,
    sort_order: idx,
  }));

  // menu_items.category_id tem FK pra menu_categories — por isso categorias
  // não podem ser simplesmente apagadas-e-recriadas se algum item ainda
  // referenciar uma categoria removida. Fazemos upsert e, à parte, apagamos
  // só as categorias que SUMIRAM da lista enviada E não têm nenhum produto
  // (o admin, ao excluir uma categoria com produtos, precisa mover os
  // produtos pra outra categoria primeiro — ver ToolsHub/menu tab — então
  // quando a exclusão chega até aqui, ela já está vazia e a FK não barra).
  const { error } = await supabase.from('menu_categories').upsert(rows, { onConflict: 'restaurant_id,id' });
  if (error) throw error;

  const { data: existingRows, error: existingErr } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId);
  if (existingErr) throw existingErr;
  const incomingIds = new Set(categories.map((c) => c.id));
  const removedIds = (existingRows || []).map((r) => r.id).filter((id) => !incomingIds.has(id));
  if (removedIds.length > 0) {
    // Se ainda houver produto referenciando alguma dessas categorias, a FK
    // (menu_items.category_id -> menu_categories.id) rejeita o delete e a
    // categoria simplesmente permanece no banco (mesmo comportamento seguro
    // de antes) — não tratamos isso como erro fatal da rota.
    await supabase.from('menu_categories').delete().eq('restaurant_id', restaurantId).in('id', removedIds);
  }

  return categories;
}

// ---------- Vitrine principal "/" (config global, não por restaurante) ----------

const DEFAULT_PLATFORM_SETTINGS = {
  landingTitle: 'Escolha seu restaurante',
  landingSubtitle: 'Cada loja tem seu próprio cardápio e pedidos',
  landingLayout: 'galeria-gourmet',
};

export async function getPlatformSettings() {
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PLATFORM_SETTINGS;
  return {
    landingTitle: data.landing_title,
    landingSubtitle: data.landing_subtitle,
    landingLayout: data.landing_layout,
  };
}

export async function updatePlatformSettings(incoming) {
  const row = { id: true };
  if (incoming.landingTitle !== undefined) row.landing_title = incoming.landingTitle;
  if (incoming.landingSubtitle !== undefined) row.landing_subtitle = incoming.landingSubtitle;
  if (incoming.landingLayout !== undefined) row.landing_layout = incoming.landingLayout;
  const { error } = await supabase.from('platform_settings').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  return getPlatformSettings();
}

export async function updateConfig(slug, incoming) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) throw new Error(`Restaurante "${slug}" não encontrado.`);

  if (incoming.name !== undefined) {
    const { error } = await supabase.from('restaurants').update({ name: incoming.name }).eq('id', restaurantId);
    if (error) throw error;
  }

  const configRow = configApiToRow(incoming);
  configRow.restaurant_id = restaurantId;

  // Rede de segurança: se alguma migration da Fase 4 (badges, entrega,
  // ajuste operacional etc.) ainda não tiver sido aplicada nesse banco
  // Supabase, a coluna correspondente não existe e o upsert falha inteiro —
  // TODO o salvamento de configuração quebrava por causa de UM campo novo
  // que o banco ainda não conhece, mesmo pra edições que nada tinham a ver
  // com aquele campo (ex: trocar a sequência de fotos falhava por causa de
  // "badges" ausente). Aqui, se o Postgres reclamar de coluna inexistente
  // (42703), removemos só aquele campo do payload e tentamos de novo —
  // várias vezes se precisar — em vez de derrubar o salvamento inteiro.
  // O campo em si só passa a persistir depois que a migration for aplicada.
  let attemptRow = { ...configRow };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error: upsertErr } = await supabase
      .from('restaurant_configs')
      .upsert(attemptRow, { onConflict: 'restaurant_id' });
    if (!upsertErr) break;
    // PostgreSQL usa 42703; PostgREST normalmente devolve PGRST204
    // quando a coluna não está no schema cache. Em ambos os casos,
    // extraímos o nome da coluna e tentamos novamente sem ela.
    const missingColumnMatch =
      (upsertErr.code === '42703' && upsertErr.message?.match(/column "([a-z_]+)"/i)) ||
      (upsertErr.code === 'PGRST204' &&
        (upsertErr.message?.match(/Could not find the '([a-z_]+)' column/i) ||
         upsertErr.message?.match(/column "([a-z_]+)"/i)));
    if (!missingColumnMatch) throw upsertErr;
    const missingColumn = missingColumnMatch[1];
    console.error(
      `⚠️  Coluna "${missingColumn}" não existe em restaurant_configs — rode as migrations pendentes em supabase/migrations/. Salvando sem esse campo por enquanto.`
    );
    delete attemptRow[missingColumn];
  }

  const { data: restaurantRow } = await supabase.from('restaurants').select('*').eq('id', restaurantId).maybeSingle();
  const { data: fullConfigRow } = await supabase
    .from('restaurant_configs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  return configRowToApi(restaurantRow, fullConfigRow);
}

// ---------- Usuários do painel + permissões granulares (Fase 4, itens 17-19) ----------

function adminUserRowToApi(row) {
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    passwordHash: row.password_hash,
    restaurantSlug: row.restaurant_slug || null,
    role: row.role,
    active: row.active,
    permissions: row.permissions || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminUsers() {
  const { data, error } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(adminUserRowToApi);
}

export async function getAdminUserByLogin(login) {
  const { data, error } = await supabase.from('admin_users').select('*').eq('login', login).maybeSingle();
  if (error) throw error;
  return data ? adminUserRowToApi(data) : null;
}

export async function getAdminUserById(id) {
  const { data, error } = await supabase.from('admin_users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? adminUserRowToApi(data) : null;
}

export async function createAdminUser({ name, login, passwordHash, restaurantSlug, role, permissions }) {
  const row = {
    name,
    login,
    password_hash: passwordHash,
    restaurant_slug: restaurantSlug || null,
    role: role || 'operador',
    permissions: permissions || {},
  };
  const { data, error } = await supabase.from('admin_users').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') {
      const err = new Error('Já existe um usuário com esse login.');
      err.code = 'LOGIN_TAKEN';
      throw err;
    }
    throw error;
  }
  return adminUserRowToApi(data);
}

export async function updateAdminUser(id, patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.restaurantSlug !== undefined) row.restaurant_slug = patch.restaurantSlug;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.permissions !== undefined) row.permissions = patch.permissions;
  if (patch.passwordHash !== undefined) row.password_hash = patch.passwordHash;
  const { data, error } = await supabase.from('admin_users').update(row).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data ? adminUserRowToApi(data) : null;
}

// ---------- Auditoria e logs administrativos ----------
export async function createAdminLoginLog(entry) { const {error}=await supabase.from('admin_login_logs').insert({admin_user_id:entry.adminUserId||null,login:entry.login||null,success:!!entry.success,mode:entry.mode||'unknown',ip:entry.ip||null,user_agent:entry.userAgent||null,details:entry.details||{}}); if(error) throw error; }
export async function listAdminLoginLogs(limit=100) { const {data,error}=await supabase.from('admin_login_logs').select('*').order('created_at',{ascending:false}).limit(Math.min(Number(limit)||100,500)); if(error) throw error; return (data||[]).map(r=>({id:r.id,createdAt:r.created_at,adminUserId:r.admin_user_id,login:r.login,success:r.success,mode:r.mode,ip:r.ip,userAgent:r.user_agent,details:r.details||{}})); }
export async function clearAdminLoginLogs() { const {error}=await supabase.from('admin_login_logs').delete().neq('id','00000000-0000-0000-0000-000000000000'); if(error) throw error; return true; }
export async function deleteAdminLoginLog(id) { const {error}=await supabase.from('admin_login_logs').delete().eq('id',id); if(error) throw error; return true; }
export async function createErrorLog(entry) { const {error}=await supabase.from('error_logs').insert({level:entry.level||'error',context:entry.context||null,message:entry.message||'Erro',stack:entry.stack||null,restaurant_slug:entry.restaurantSlug||null,details:entry.details||{}}); if(error) throw error; }
export async function listErrorLogs(limit=100) { const {data,error}=await supabase.from('error_logs').select('*').order('created_at',{ascending:false}).limit(Math.min(Number(limit)||100,500)); if(error) throw error; return (data||[]).map(r=>({id:r.id,createdAt:r.created_at,level:r.level,context:r.context,message:r.message,stack:r.stack,restaurantSlug:r.restaurant_slug,details:r.details||{}})); }
export async function clearErrorLogs() { const {error}=await supabase.from('error_logs').delete().neq('id','00000000-0000-0000-0000-000000000000'); if(error) throw error; return true; }
export async function deleteErrorLog(id) { const {error}=await supabase.from('error_logs').delete().eq('id',id); if(error) throw error; return true; }

// ---------- Contas de cliente + endereços salvos (Fase 4, itens 20-22) ----------

function customerRowToApi(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function customerAddressRowToApi(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    label: row.label,
    cep: row.cep || undefined,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city || undefined,
    state: row.state || undefined,
    unit: row.unit || undefined,
    complement: row.complement || undefined,
    reference: row.reference || undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    isDefault: row.is_default,
  };
}

export async function createCustomer({ name, phone, email, passwordHash }) {
  const row = { name, phone, email: email || null, password_hash: passwordHash };
  const { data, error } = await supabase.from('customers').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') {
      const detail = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      const err = new Error(detail.includes('phone') ? 'Já existe uma conta com esse telefone.' : 'Não foi possível criar a conta porque um dado informado já está cadastrado.');
      err.code = detail.includes('phone') ? 'PHONE_TAKEN' : 'CUSTOMER_DUPLICATE';
      throw err;
    }
    throw error;
  }
  return customerRowToApi(data);
}

export async function listCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(customerRowToApi);
}

export async function deleteCustomer(id) {
  const { data, error } = await supabase.from('customers').delete().eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data ? customerRowToApi(data) : null;
}

export async function getCustomerByPhone(phone) {
  const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
  if (error) throw error;
  return data ? customerRowToApi(data) : null;
}

export async function getCustomerById(id) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? customerRowToApi(data) : null;
}

export async function updateCustomer(id, patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.passwordHash !== undefined) row.password_hash = patch.passwordHash;
  const { data, error } = await supabase.from('customers').update(row).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data ? customerRowToApi(data) : null;
}

export async function listCustomerAddresses(customerId) {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(customerAddressRowToApi);
}

export async function createCustomerAddress(customerId, addr) {
  const row = {
    customer_id: customerId,
    label: addr.label || 'Casa',
    cep: addr.cep || null,
    street: addr.street,
    number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city || null,
    state: addr.state || null,
    unit: addr.unit || null,
    complement: addr.complement || null,
    reference: addr.reference || null,
    lat: addr.lat ?? null,
    lng: addr.lng ?? null,
    is_default: Boolean(addr.isDefault),
  };
  const { data, error } = await supabase.from('customer_addresses').insert(row).select('*').single();
  if (error) throw error;
  return customerAddressRowToApi(data);
}

export async function updateCustomerAddress(id, customerId, patch) {
  const row = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.cep !== undefined) row.cep = patch.cep;
  if (patch.street !== undefined) row.street = patch.street;
  if (patch.number !== undefined) row.number = patch.number;
  if (patch.neighborhood !== undefined) row.neighborhood = patch.neighborhood;
  if (patch.city !== undefined) row.city = patch.city;
  if (patch.state !== undefined) row.state = patch.state;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.complement !== undefined) row.complement = patch.complement;
  if (patch.reference !== undefined) row.reference = patch.reference;
  if (patch.lat !== undefined) row.lat = patch.lat;
  if (patch.lng !== undefined) row.lng = patch.lng;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  const { data, error } = await supabase
    .from('customer_addresses')
    .update(row)
    .eq('id', id)
    .eq('customer_id', customerId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? customerAddressRowToApi(data) : null;
}

export async function deleteCustomerAddress(id, customerId) {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id).eq('customer_id', customerId);
  if (error) throw error;
  return true;
}

export async function listCustomerOrders(customerId) {
  const { data: orderRows, error } = await supabase
    .from('orders')
    .select('*, restaurants(slug, name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!orderRows || orderRows.length === 0) return [];

  const { data: itemRows, error: itemErr } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderRows.map((o) => o.id));
  if (itemErr) throw itemErr;

  const itemsByOrder = new Map();
  for (const it of itemRows || []) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }
  return orderRows.map((o) => ({
    ...orderRowToApi(o, itemsByOrder.get(o.id)),
    restaurantSlug: o.restaurants?.slug,
    restaurantName: o.restaurants?.name,
  }));
}

// ---------- Notificações push + campanhas automáticas (Fase 4, itens 27-30) ----------

function pushSubscriptionRowToApi(row) {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    customerId: row.customer_id || null,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    createdAt: row.created_at,
  };
}

function campaignRowToApi(row) {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    name: row.name,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url || undefined,
    audience: row.audience,
    schedule: row.schedule || {},
    active: row.active,
    lastSentAt: row.last_sent_at || null,
    lastSentWindow: row.last_sent_window || null,
    createdAt: row.created_at,
  };
}

export async function createPushSubscription({ restaurantSlug, customerId, endpoint, p256dh, auth }) {
  const row = {
    restaurant_slug: restaurantSlug,
    customer_id: customerId || null,
    endpoint,
    p256dh,
    auth,
  };
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select('*')
    .single();
  if (error) throw error;
  return pushSubscriptionRowToApi(data);
}

export async function deletePushSubscriptionByEndpoint(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
  return true;
}

export async function deletePushSubscriptionsByIds(ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.from('push_subscriptions').delete().in('id', ids);
  if (error) throw error;
}

export async function listPushSubscriptions(restaurantSlug, { onlyCustomers = false } = {}) {
  let query = supabase.from('push_subscriptions').select('*').eq('restaurant_slug', restaurantSlug);
  if (onlyCustomers) query = query.not('customer_id', 'is', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(pushSubscriptionRowToApi);
}

export async function listNotificationCampaigns(restaurantSlug) {
  const { data, error } = await supabase
    .from('notification_campaigns')
    .select('*')
    .eq('restaurant_slug', restaurantSlug)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(campaignRowToApi);
}

export async function listAllActiveCampaigns() {
  const { data, error } = await supabase.from('notification_campaigns').select('*').eq('active', true);
  if (error) throw error;
  return (data || []).map(campaignRowToApi);
}

export async function createNotificationCampaign(restaurantSlug, data) {
  const row = {
    restaurant_slug: restaurantSlug,
    name: data.name,
    title: data.title,
    message: data.message,
    image_url: data.imageUrl || null,
    audience: data.audience || 'all',
    schedule: data.schedule || {},
  };
  const { data: created, error } = await supabase.from('notification_campaigns').insert(row).select('*').single();
  if (error) throw error;
  return campaignRowToApi(created);
}

export async function getNotificationCampaignById(id) {
  const { data, error } = await supabase.from('notification_campaigns').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? campaignRowToApi(data) : null;
}

export async function updateNotificationCampaign(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.message !== undefined) row.message = patch.message;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.audience !== undefined) row.audience = patch.audience;
  if (patch.schedule !== undefined) row.schedule = patch.schedule;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.lastSentAt !== undefined) row.last_sent_at = patch.lastSentAt;
  if (patch.lastSentWindow !== undefined) row.last_sent_window = patch.lastSentWindow;
  const { data, error } = await supabase
    .from('notification_campaigns')
    .update(row)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? campaignRowToApi(data) : null;
}

export async function deleteNotificationCampaign(id) {
  const { error } = await supabase.from('notification_campaigns').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ---------- Assistente de atendimento com IA (Fase 4, itens 32-39) ----------

function conversationRowToApi(row) {
  return {
    id: row.id,
    restaurantSlug: row.restaurant_slug,
    customerId: row.customer_id || null,
    sessionId: row.session_id || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function aiMessageRowToApi(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function findOrCreateAiConversation({ restaurantSlug, customerId, sessionId }) {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('restaurant_slug', restaurantSlug)
    .neq('status', 'closed');
  if (customerId) query = query.eq('customer_id', customerId);
  else if (sessionId) query = query.eq('session_id', sessionId);
  const { data: existingRows, error: findErr } = await query.limit(1);
  if (findErr) throw findErr;
  if (existingRows && existingRows.length > 0) return conversationRowToApi(existingRows[0]);

  const row = { restaurant_slug: restaurantSlug, customer_id: customerId || null, session_id: sessionId || null };
  const { data, error } = await supabase.from('ai_conversations').insert(row).select('*').single();
  if (error) throw error;
  return conversationRowToApi(data);
}

export async function getAiConversation(id) {
  const { data, error } = await supabase.from('ai_conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? conversationRowToApi(data) : null;
}

export async function listAiConversations(restaurantSlug, { status } = {}) {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('restaurant_slug', restaurantSlug)
    .order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(conversationRowToApi);
}

export async function updateAiConversationStatus(id, status) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? conversationRowToApi(data) : null;
}

export async function addAiMessage(conversationId, role, content) {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select('*')
    .single();
  if (error) throw error;
  await supabase
    .from('ai_conversations')
    .update({ updated_at: data.created_at })
    .eq('id', conversationId);
  return aiMessageRowToApi(data);
}

export async function listAiMessages(conversationId) {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(aiMessageRowToApi);
}

// ---------- Biblioteca de imagens ----------
function mediaRowToApi(row) {
  return {
    id: row.id,
    restaurantSlug: row.restaurants?.slug,
    restaurantId: row.restaurant_id,
    storageProvider: row.storage_provider,
    bucket: row.bucket,
    storagePath: row.storage_path,
    url: row.url,
    kind: row.kind,
    entityType: row.entity_type,
    entityId: row.entity_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    altText: row.alt_text,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMediaAsset(asset) {
  const restaurantId = asset.restaurantId || await resolveRestaurantId(asset.restaurantSlug);
  if (!restaurantId) throw new Error('Restaurante não encontrado.');
  const row = {
    id: asset.id,
    restaurant_id: restaurantId,
    storage_provider: asset.storageProvider,
    bucket: asset.bucket || null,
    storage_path: asset.storagePath || null,
    url: asset.url,
    kind: asset.kind || 'other',
    entity_type: asset.entityType || null,
    entity_id: asset.entityId || null,
    original_name: asset.originalName || null,
    mime_type: asset.mimeType || null,
    size_bytes: asset.sizeBytes ?? null,
    alt_text: asset.altText || null,
    metadata: asset.metadata || {},
  };
  const { data, error } = await supabase.from('media_assets').insert(row).select('*').single();
  if (error) throw error;
  return mediaRowToApi(data);
}

export async function listMediaAssets(slug, options = {}) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return [];
  let query = supabase.from('media_assets').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
  if (options.kind) query = query.eq('kind', options.kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mediaRowToApi);
}

export async function getMediaAssetById(slug, id) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return null;
  const { data, error } = await supabase.from('media_assets').select('*').eq('restaurant_id', restaurantId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mediaRowToApi(data) : null;
}

export async function deleteMediaAsset(slug, id) {
  const restaurantId = await resolveRestaurantId(slug);
  if (!restaurantId) return null;
  const existing = await getMediaAssetById(slug, id);
  if (!existing) return null;
  const { error } = await supabase.from('media_assets').delete().eq('restaurant_id', restaurantId).eq('id', id);
  if (error) throw error;
  return existing;
}

export async function listPrintJobs(slug, limit = 100) {
  const restaurantId = await resolveRestaurantId(slug); if (!restaurantId) return [];
  const { data, error } = await supabase.from('print_jobs').select('*').eq('restaurant_id', restaurantId).order('created_at',{ascending:false}).limit(Math.min(Math.max(Number(limit)||100,1),500));
  if (error) throw error;
  return (data||[]).map(r => ({ id:r.id, restaurantSlug:slug, orderId:r.order_id, orderNumber:r.order_number, variant:r.variant, status:r.status, attempts:r.attempts, createdAt:r.created_at, updatedAt:r.updated_at, error:r.error }));
}
export async function createPrintJob(slug, input) {
  const restaurantId = await resolveRestaurantId(slug); if (!restaurantId) return null;
  const { data, error } = await supabase.from('print_jobs').insert({ restaurant_id:restaurantId, order_id:input.orderId, order_number:input.orderNumber, variant:input.variant||'customer', status:'pendente', attempts:0 }).select('*').single();
  if (error) throw error;
  return { id:data.id, restaurantSlug:slug, orderId:data.order_id, orderNumber:data.order_number, variant:data.variant, status:data.status, attempts:data.attempts, createdAt:data.created_at, updatedAt:data.updated_at, error:data.error };
}
export async function updatePrintJob(slug, id, patch) {
  const restaurantId = await resolveRestaurantId(slug); if (!restaurantId) return null;
  const row={}; for (const k of ['status','attempts','error','variant','workerId','leaseUntil']) if (patch[k]!==undefined) row[k.replace(/[A-Z]/g,m=>'_'+m.toLowerCase())]=patch[k];
  const { data,error }=await supabase.from('print_jobs').update(row).eq('restaurant_id',restaurantId).eq('id',id).select('*').maybeSingle(); if(error)throw error; if(!data)return null;
  return { id:data.id, restaurantSlug:slug, orderId:data.order_id, orderNumber:data.order_number, variant:data.variant, status:data.status, attempts:data.attempts, createdAt:data.created_at, updatedAt:data.updated_at, error:data.error, workerId:data.worker_id, leaseUntil:data.lease_until };
}
export async function claimNextPrintJob(slug, workerId='bridge') {
  const restaurantId=await resolveRestaurantId(slug); if(!restaurantId)return null;
  const {data,error}=await supabase.rpc('claim_next_print_job',{p_restaurant_id:restaurantId,p_worker_id:workerId,p_lease_seconds:30}); if(error)throw error; const r=Array.isArray(data)?data[0]:data; if(!r)return null;
  return {id:r.id,restaurantSlug:slug,orderId:r.order_id,orderNumber:r.order_number,variant:r.variant,status:r.status,attempts:r.attempts,createdAt:r.created_at,updatedAt:r.updated_at,error:r.error,workerId:r.worker_id,leaseUntil:r.lease_until};
}


export async function createRestaurantBackup(slug, payload, createdBy = null) {
  const restaurantId=await resolveRestaurantId(slug); if(!restaurantId) return null;
  const {data,error}=await supabase.from('restaurant_backups').insert({restaurant_id:restaurantId,version:'18.0.0',payload,created_by:createdBy}).select('*').single(); if(error) throw error;
  return {id:data.id,restaurantSlug:slug,version:data.version,payload:data.payload,createdAt:data.created_at,createdBy:data.created_by};
}
export async function listRestaurantBackups(slug) { const restaurantId=await resolveRestaurantId(slug); if(!restaurantId)return []; const {data,error}=await supabase.from('restaurant_backups').select('*').eq('restaurant_id',restaurantId).order('created_at',{ascending:false}).limit(20); if(error)throw error; return (data||[]).map(x=>({id:x.id,restaurantSlug:slug,version:x.version,payload:x.payload,createdAt:x.created_at,createdBy:x.created_by})); }
export async function getRestaurantBackup(slug,id) { const restaurantId=await resolveRestaurantId(slug); if(!restaurantId)return null; const {data,error}=await supabase.from('restaurant_backups').select('*').eq('restaurant_id',restaurantId).eq('id',id).maybeSingle(); if(error)throw error; return data?{id:data.id,restaurantSlug:slug,version:data.version,payload:data.payload,createdAt:data.created_at,createdBy:data.created_by}:null; }
export async function appendRealtimeEvent(slug,event) { const restaurantId=await resolveRestaurantId(slug); if(!restaurantId)return null; const {data,error}=await supabase.from('realtime_events').insert({restaurant_id:restaurantId,event_type:event.type||'updated',payload:event}).select('*').single(); if(error)throw error; return {id:data.id,restaurantSlug:slug,payload:data.payload,createdAt:data.created_at}; }
export async function listRealtimeEvents(slug,afterId=0) { const restaurantId=await resolveRestaurantId(slug); if(!restaurantId)return []; const {data,error}=await supabase.from('realtime_events').select('*').eq('restaurant_id',restaurantId).gt('id',Number(afterId)||0).order('id',{ascending:true}).limit(200); if(error)throw error; return (data||[]).map(x=>({id:x.id,restaurantSlug:slug,payload:x.payload,createdAt:x.created_at})); }
