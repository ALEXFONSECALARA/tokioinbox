import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requirePermission } from './authMiddleware';
import * as orders from './orderServiceV2';
import { enqueuePrintJobsOnOrderCreated, enqueuePrintJobOnStatusChange } from './printJobServiceV2';

/**
 * Montado em server.ts como: app.use('/api/v2/orders', orderRoutes)
 * Convive com as rotas antigas baseadas em arquivo — nada existente quebra.
 * Quando a Fase 3 religar o frontend, essas rotas antigas podem ser removidas.
 */
export const orderRoutes = Router();

/**
 * Criar pedido. Duas situações válidas:
 *  1) Cliente autenticado criando pedido para SI MESMO (source: 'online').
 *  2) Funcionário com permissão order.create criando pedido de mesa/balcão.
 * A checagem roda aqui, não confia em nada que o frontend mande sobre "quem é".
 */
orderRoutes.post('/', requireAuth, async (req, res, next) => {
  try {
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId é obrigatório.' });

    const isCustomerSelf = req.authUser!.userType === 'customer';
    let order;
    if (isCustomerSelf) {
      // cliente só pode criar pedido em nome dele mesmo
      order = await orders.createOrder({
        ...req.body,
        restaurantId,
        customerId: req.authUser!.id,
        createdBy: req.authUser!.id,
        source: 'online',
        idempotencyKey: req.body.idempotencyKey,
      });
    } else {
      // funcionário: precisa da permissão order.create NESTE restaurante
      const { getAdminClient } = await import('./db');
      const admin = getAdminClient();
      if (!req.authUser!.isSuperAdmin) {
        const { data: allowed, error } = await admin.rpc('has_permission_for', {
          p_user_id: req.authUser!.id,
          p_key: 'order.create',
          p_restaurant_id: restaurantId,
        });
        if (error) return next(error);
        if (!allowed) return res.status(403).json({ error: "Permissão 'order.create' negada para este restaurante." });
      }

      order = await orders.createOrder({
        ...req.body,
        restaurantId,
        createdBy: req.authUser!.id,
      });
    }

    // Fase 5: enfileira impressão (cozinha/sushibar) de forma idempotente.
    // Uma falha aqui não deve derrubar a criação do pedido, só é logada.
    enqueuePrintJobsOnOrderCreated(order.id, restaurantId).catch((err) =>
      console.error('[print_jobs] falha ao enfileirar impressão do pedido', order.id, err)
    );

    return res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * Kanban central — exige order.view no restaurante informado via query string.
 * Suporte a requisição condicional (ETag/If-None-Match): se nada mudou desde
 * a última consulta, devolve 304 sem corpo — economiza banda real em
 * conexões de celular/tablet (item 2/3 do pedido de otimização de rede).
 */
orderRoutes.get(
  '/',
  requireAuth,
  requirePermission('order.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      const restaurantId = req.query.restaurantId as string;
      const statuses = req.query.status ? String(req.query.status).split(',') : undefined;
      const data = await orders.listOrdersForKanban(restaurantId, statuses);

      // ETag construído a partir de id+status+updated_at de cada pedido: muda
      // se e só se algo relevante mudou, então o cliente só rebaixa o JSON
      // inteiro quando realmente há novidade.
      const fingerprint = data
        .map((o: any) => `${o.id}:${o.status}:${o.updated_at}`)
        .sort()
        .join('|');
      const etag = `"${crypto.createHash('sha1').update(fingerprint).digest('hex')}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-cache');

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

/** Visão restrita da cozinha/sushibar — mesma permissão order.view, filtrado por destino. */
orderRoutes.get(
  '/by-destination/:destination',
  requireAuth,
  requirePermission('order.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      const data = await orders.listOrdersByDestination(
        req.query.restaurantId as string,
        req.params.destination
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

orderRoutes.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser!.userType !== 'customer') {
      return res.status(403).json({ error: 'Rota exclusiva para clientes.' });
    }
    const data = await orders.listOrdersForCustomer(req.authUser!.id, req.query.restaurantId as string | undefined);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

orderRoutes.get(
  '/:id',
  requireAuth,
  requirePermission('order.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      const data = await orders.getOrderById(req.params.id, req.query.restaurantId as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Mudar status do pedido. A permissão depende da transição:
 * cancelar exige order.cancel, finalizar exige order.close, o resto order.edit.
 */
orderRoutes.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { restaurantId, status, note } = req.body;
    if (!restaurantId || !status) {
      return res.status(400).json({ error: 'restaurantId e status são obrigatórios.' });
    }
    const permissionNeeded =
      status === 'cancelado' ? 'order.cancel' : status === 'finalizado' ? 'order.close' : 'order.edit';

    if (!req.authUser!.isSuperAdmin) {
      const { getAdminClient } = await import('./db');
      const admin = getAdminClient();
      const { data: allowed, error } = await admin.rpc('has_permission_for', {
        p_user_id: req.authUser!.id,
        p_key: permissionNeeded,
        p_restaurant_id: restaurantId,
      });
      if (error) return next(error);
      if (!allowed) {
        return res.status(403).json({ error: `Permissão '${permissionNeeded}' negada para este restaurante.` });
      }
    }

    const order = await orders.updateOrderStatus(req.params.id, restaurantId, status, req.authUser!.id, note);

    // Fase 5: ticket de "pronto" pro caixa, "saiu pra entrega" pro motoboy — idempotente.
    enqueuePrintJobOnStatusChange(req.params.id, restaurantId, status).catch((err) =>
      console.error('[print_jobs] falha ao enfileirar impressão de status', req.params.id, err)
    );

    res.json(order);
  } catch (err) {
    next(err);
  }
});
