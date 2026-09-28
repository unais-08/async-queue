import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger';

export function workerAuth(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.WORKER_API_KEY;
  if (!expectedKey) {
    logger.error('Worker API key is not configured');
    return res.status(503).json({ error: 'Worker operations are not configured' });
  }

  if (req.header('x-worker-key') !== expectedKey) {
    logger.warn('Unauthorized worker request', { method: req.method, path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
