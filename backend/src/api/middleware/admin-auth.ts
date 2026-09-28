import { NextFunction, Request, Response } from 'express';
import { logger } from "../../utils/logger";

export function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    logger.error('Admin API key is not configured');
    return res.status(503).json({
      error: 'Admin operations are not configured',
    });
  }

  const providedKey = req.header('x-admin-key');

  if (!providedKey || providedKey !== expectedKey) {
    logger.warn('Unauthorized admin request', {
      method: req.method,
      path: req.path,
    });

    return res.status(401).json({
      error: 'Unauthorized',
    });
  }

  next();
}
