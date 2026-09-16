import { Router } from 'express';
import { requireAuth, requirePermission } from './authMiddleware';
import { upsertIngredient, setProductRecipe, listProductCmv, generateMenuSuggestions } from './cmvServiceV2';

export const cmvRoutes = Router();

cmvRoutes.get(
  '/products',
  requireAuth,
  requirePermission('product.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      res.json(await listProductCmv(req.query.restaurantId as string));
    } catch (err) {
      next(err);
    }
  }
);

cmvRoutes.post(
  '/ingredients',
  requireAuth,
  requirePermission('product.edit', (req) => req.body.restaurantId as string),
  async (req, res, next) => {
    try {
      const { restaurantId, ...input } = req.body;
      res.status(201).json(await upsertIngredient(restaurantId, input));
    } catch (err) {
      next(err);
    }
  }
);

cmvRoutes.put(
  '/products/:productId/recipe',
  requireAuth,
  requirePermission('product.edit', (req) => req.body.restaurantId as string),
  async (req, res, next) => {
    try {
      res.json(await setProductRecipe(req.params.productId, req.body.items ?? []));
    } catch (err) {
      next(err);
    }
  }
);

/** Alimenta o painel de "IA Autônoma de Sugestão" com dados reais de venda dos últimos N dias. */
cmvRoutes.get(
  '/suggestions',
  requireAuth,
  requirePermission('reports.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      res.json(await generateMenuSuggestions(req.query.restaurantId as string, days));
    } catch (err) {
      next(err);
    }
  }
);
