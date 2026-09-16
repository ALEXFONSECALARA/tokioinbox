import { Router } from 'express';
import { requireAuth } from './authMiddleware';
import { getAdminClient } from './db';
import { listRestaurantsForUser } from './restaurantService';

/**
 * FASE 3 — Endpoint central que o frontend consulta uma vez após o login para
 * saber: quem é o usuário, se é super admin, e a qual(is) restaurante(s) e
 * papéis ele tem acesso. É isso que decide o que a rota /operacao mostra
 * (garçom vê mesas, caixa vê balcão, etc.) em vez de qualquer coisa guardada
 * no localStorage.
 */
export const meRoutes = Router();

meRoutes.get('/', requireAuth, async (req, res, next) => {
  try {
    const admin = getAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('id, user_type, full_name, phone, is_super_admin')
      .eq('id', req.authUser!.id)
      .single();
    if (error || !profile) return res.status(404).json({ error: 'Perfil não encontrado.' });

    if (profile.user_type === 'customer') {
      return res.json({ profile, restaurants: [] });
    }

    let restaurants: Array<{ id: string; slug: string; name: string; logoUrl: string | null; roleKey: string }>;
    if (profile.is_super_admin) {
      const { data } = await admin.from('restaurants').select('id, slug, name, logo_url');
      restaurants = (data ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logoUrl: r.logo_url,
        roleKey: 'super_admin',
      }));
    } else {
      const rows = await listRestaurantsForUser(profile.id);
      restaurants = (rows ?? [])
        .filter((row: any) => row.restaurant)
        .map((row: any) => ({
          id: row.restaurant.id,
          slug: row.restaurant.slug,
          name: row.restaurant.name,
          logoUrl: row.restaurant.logo_url,
          roleKey: row.role?.key ?? 'desconhecido',
        }));
    }

    res.json({ profile, restaurants });
  } catch (err) {
    next(err);
  }
});
