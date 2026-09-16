import { getAdminClient } from './db';

/**
 * FASE 1 — Substitui completamente o antigo authAndDeviceService baseado em
 * arquivos JSON e usuários hardcoded (admin/admin123 etc). Agora:
 *  - A senha nunca é manipulada por este código: o Supabase Auth cuida do
 *    hash/verificação/sessão/JWT.
 *  - `profiles` guarda só metadados (nome, tipo, super_admin).
 *  - `restaurant_users` guarda o vínculo de um funcionário a um restaurante
 *    com um papel — um mesmo usuário pode estar em vários restaurantes.
 */

export interface CreateStaffUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  restaurantId: string;
  roleKey: string; // 'gerente' | 'caixa' | 'garcom' | 'cozinha' | 'sushibar' | 'motoboy'
}

export interface CreateCustomerInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

/** Usado apenas pelo Super Admin (rota protegida por requireSuperAdmin). */
export async function createStaffUser(input: CreateStaffUserInput) {
  const admin = getAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    throw new Error(createErr?.message || 'Falha ao criar usuário no Supabase Auth.');
  }

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    user_type: 'staff',
    full_name: input.fullName,
    phone: input.phone,
    is_super_admin: false,
    is_active: true,
  });
  if (profileErr) throw new Error(profileErr.message);

  const { data: role, error: roleErr } = await admin
    .from('roles')
    .select('id')
    .eq('key', input.roleKey)
    .single();
  if (roleErr || !role) throw new Error(`Papel '${input.roleKey}' não encontrado.`);

  const { error: linkErr } = await admin.from('restaurant_users').insert({
    restaurant_id: input.restaurantId,
    user_id: created.user.id,
    role_id: role.id,
    is_active: true,
  });
  if (linkErr) throw new Error(linkErr.message);

  return { id: created.user.id, email: input.email };
}

/** Cadastro de cliente da vitrine (self-service, rota pública). */
export async function createCustomer(input: CreateCustomerInput) {
  const admin = getAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    throw new Error(createErr?.message || 'Falha ao criar conta.');
  }
  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    user_type: 'customer',
    full_name: input.fullName,
    phone: input.phone,
    is_super_admin: false,
    is_active: true,
  });
  if (profileErr) throw new Error(profileErr.message);
  return { id: created.user.id, email: input.email };
}

/**
 * Cria (ou promove) o PRIMEIRO Super Admin da plataforma.
 * Só funciona se ainda não existir nenhum super admin — depois disso, novos
 * super admins só podem ser criados por um super admin já existente através
 * da rota administrativa. Isso evita credencial fixa no código-fonte.
 */
export async function bootstrapFirstSuperAdmin(email: string, password: string, fullName: string) {
  const admin = getAdminClient();
  const { count, error: countErr } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_super_admin', true);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) > 0) {
    throw new Error('Já existe um Super Admin. Use a área /admin para criar novos usuários.');
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) throw new Error(createErr?.message || 'Falha ao criar Super Admin.');

  const { error: profileErr } = await admin.from('profiles').insert({
    id: created.user.id,
    user_type: 'staff',
    full_name: fullName,
    is_super_admin: true,
    is_active: true,
  });
  if (profileErr) throw new Error(profileErr.message);

  return { id: created.user.id, email };
}

export async function listUsersForRestaurant(restaurantId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('restaurant_users')
    .select('id, is_active, created_at, role:roles(key, name), user:profiles(id, full_name, phone, is_active)')
    .eq('restaurant_id', restaurantId);
  if (error) throw new Error(error.message);
  return data;
}

export async function setIndividualPermission(
  restaurantUserId: string,
  permissionKey: string,
  allowed: boolean
) {
  const admin = getAdminClient();
  const { data: perm, error: permErr } = await admin
    .from('permissions')
    .select('id')
    .eq('key', permissionKey)
    .single();
  if (permErr || !perm) throw new Error(`Permissão '${permissionKey}' não encontrada.`);

  const { error } = await admin
    .from('user_permissions')
    .upsert({ restaurant_user_id: restaurantUserId, permission_id: perm.id, allowed });
  if (error) throw new Error(error.message);
}

export async function deactivateStaffUser(restaurantUserId: string) {
  const admin = getAdminClient();
  const { error } = await admin.from('restaurant_users').update({ is_active: false }).eq('id', restaurantUserId);
  if (error) throw new Error(error.message);
}
