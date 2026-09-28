import { Router } from 'express';
import {
  createJob,
  getJob,
  listJobs,
  retryJob,
} from '../controllers/job.controller';
import { asyncHandler } from '../middleware/async-handler';
import { adminAuth } from '../middleware/admin-auth';

const router = Router();

router.post('/', asyncHandler(createJob));
router.get('/', asyncHandler(listJobs));
router.get('/:id', asyncHandler(getJob));
router.post('/:id/retry', adminAuth, asyncHandler(retryJob));

export default router;
