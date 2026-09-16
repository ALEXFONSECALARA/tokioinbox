import { getAdminClient } from './db';

export interface RestaurantInput {
  slug: string;
  name: string;
  logoUrl?: string;
  coverImageUrl?: string;
  description?: string;
  address?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  deliverySettings?: Record<string, unknown>;
  printingSettings?: Record<string, unknown>;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertValidSlug(slug: string) {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error('Slug inválido: use apenas letras minúsculas, números e hífens (ex: sakura-sushi-house).');
  }
}

/** Vitrine pública — só restaurantes ativos, campos públicos apenas. */
export async function listPublicRestaurants() {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug, name, logo_url, cover_image_url, description, delivery_settings')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getRestaurantBySlug(slug: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.from('restaurants').select('*').eq('slug', slug).single();
  if (error) throw new Error(error.message);
  return data;
}

/** Somente Super Admin (a rota que chama isso deve estar atrás de requireSuperAdmin). */
export async function createRestaurant(input: RestaurantInput) {
  assertValidSlug(input.slug);
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .insert({
      slug: input.slug,
      name: input.name,
      logo_url: input.logoUrl,
      cover_image_url: input.coverImageUrl,
      description: input.description,
      address: input.address ?? {},
      settings: input.settings ?? {},
      delivery_settings: input.deliverySettings ?? {},
      printing_settings: input.printingSettings ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRestaurant(id: string, input: Partial<RestaurantInput>) {
  if (input.slug) assertValidSlug(input.slug);
  const admin = getAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.slug) patch.slug = input.slug;
  if (input.name) patch.name = input.name;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.description !== undefined) patch.description = input.description;
  if (input.address) patch.address = input.address;
  if (input.settings) patch.settings = input.settings;
  if (input.deliverySettings) patch.delivery_settings = input.deliverySettings;
  if (input.printingSettings) patch.printing_settings = input.printingSettings;

  const { data, error } = await admin.from('restaurants').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/** Desativa (nunca apaga fisicamente pedidos/histórico de um restaurante). */
export async function deactivateRestaurant(id: string) {
  const admin = getAdminClient();
  const { error } = await admin.from('restaurants').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listAllRestaurantsForSuperAdmin() {
  const admin = getAdminClient();
  const { data, error } = await admin.from('restaurants').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/** Restaurantes que um funcionário (não super admin) está autorizado a acessar. */
export async function listRestaurantsForUser(userId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('restaurant_users')
    .select('restaurant:restaurants(id, slug, name, logo_url, is_active), role:roles(key, name)')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return data;
}
