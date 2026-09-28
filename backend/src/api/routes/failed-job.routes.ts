import { Router } from 'express';
import { listFailedJobs } from '../controllers/failed-job.controller';
import { asyncHandler } from '../middleware/async-handler';
import { adminAuth } from '../middleware/admin-auth';

const router = Router();

router.use(adminAuth);
router.get('/', asyncHandler(listFailedJobs));

export default router;
