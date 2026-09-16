import { Router } from 'express';
import { requireAuth, requirePermission } from './authMiddleware';
import { listPendingPrintJobs, markPrintJobPrinted } from './printJobServiceV2';

export const printJobRoutes = Router();

printJobRoutes.get(
  '/',
  requireAuth,
  requirePermission('printing.view', (req) => req.query.restaurantId as string),
  async (req, res, next) => {
    try {
      const data = await listPendingPrintJobs(
        req.query.restaurantId as string,
        req.query.destination as string | undefined
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

printJobRoutes.patch(
  '/:id/printed',
  requireAuth,
  requirePermission('printing.manage', (req) => req.body.restaurantId as string),
  async (req, res, next) => {
    try {
      await markPrintJobPrinted(req.params.id, req.body.restaurantId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);
