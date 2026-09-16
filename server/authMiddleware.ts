import type { Request, Response, NextFunction } from 'express';
import { getAdminClient } from './db';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  userType: 'staff' | 'customer';
  isSuperAdmin: boolean;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      accessToken?: string;
    }
  }
}

/**
 * Extrai e valida o JWT do header Authorization. Não confia em NADA vindo do
 * corpo da requisição ou de headers customizados — a única fonte de verdade
 * sobre "quem é esse usuário" é o token validado pelo Supabase Auth.
 * (Atende à seção 15 do briefing: autorização real no backend.)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }
    const token = authHeader.slice('Bearer '.length);
    const admin = getAdminClient();

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, user_type, is_super_admin, is_active, full_name')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Perfil não encontrado para este usuário.' });
    }
    if (!profile.is_active) {
      return res.status(403).json({ error: 'Usuário desativado.' });
    }

    req.authUser = {
      id: profile.id,
      email: userData.user.email ?? undefined,
      userType: profile.user_type,
      isSuperAdmin: profile.is_super_admin,
      fullName: profile.full_name,
    };
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Exige que o usuário autenticado tenha uma permissão específica NO CONTEXTO
 * de um restaurante identificado por req.params[restaurantIdParam] (ou pela
 * função getRestaurantId, quando o id não vem direto da URL).
 *
 * Isso é o que impede um usuário de trocar a URL/corpo da requisição para
 * acessar dados de outro restaurante (seção 15 do briefing) — a checagem
 * roda sempre no banco via has_permission_for(), nunca só no frontend.
 */
export function requirePermission(
  permissionKey: string,
  getRestaurantId: (req: Request) => string | undefined = (req) =>
    (req.params.restaurantId as string) || (req.body?.restaurant_id as string) || (req.query.restaurantId as string)
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Não autenticado.' });
      }
      const restaurantId = getRestaurantId(req);
      if (!restaurantId) {
        return res.status(400).json({ error: 'restaurant_id é obrigatório para verificar permissão.' });
      }
      if (req.authUser.isSuperAdmin) {
        return next();
      }
      const admin = getAdminClient();
      const { data: allowed, error } = await admin.rpc('has_permission_for', {
        p_user_id: req.authUser.id,
        p_key: permissionKey,
        p_restaurant_id: restaurantId,
      });
      if (error) {
        return next(error);
      }
      if (!allowed) {
        return res.status(403).json({
          error: `Acesso negado: permissão '${permissionKey}' não concedida para este restaurante.`,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Restringe a rota apenas ao Super Admin. */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) return res.status(401).json({ error: 'Não autenticado.' });
  if (!req.authUser.isSuperAdmin) {
    return res.status(403).json({ error: 'Somente o Super Admin pode acessar este recurso.' });
  }
  next();
}
