import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { workerAuth } from '../middleware/worker-auth';
import { claimJob, completeJob, failJob, heartbeatJob } from '../controllers/worker.controller';

const router = Router();
router.use(workerAuth);
router.post('/jobs/claim', asyncHandler(claimJob));
router.post('/jobs/:id/heartbeat', asyncHandler(heartbeatJob));
router.post('/jobs/:id/complete', asyncHandler(completeJob));
router.post('/jobs/:id/fail', asyncHandler(failJob));

export default router;
