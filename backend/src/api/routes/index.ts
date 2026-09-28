import { Router } from 'express';
import jobRoutes from './job.routes';
import failedJobRoutes from './failed-job.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use('/jobs', jobRoutes);
router.use('/admin/failed-jobs', failedJobRoutes);

export default router;
