import { Router } from 'express';
import jobRoutes from './job.routes';
import failedJobRoutes from './failed-job.routes';
import workerRoutes from './worker.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({
  ok: true,
  workerConfigured: Boolean(process.env.WORKER_API_KEY),
}));
router.use('/jobs', jobRoutes);
router.use('/worker', workerRoutes);
router.use('/admin/failed-jobs', failedJobRoutes);

export default router;
