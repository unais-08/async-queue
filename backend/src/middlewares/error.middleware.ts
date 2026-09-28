import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';
import { logger } from '../utils/logger';

const DB_CONNECTION_ERROR_CODES = new Set([
    '08000', '08001', '08003', '08004', '08006', '53300', '57P01',
]);

type ErrorWithCode = Error & { code?: string };

export const errorHandler: ErrorRequestHandler = (
    err: ErrorWithCode,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    logger.error('Request failed', err, {
        method: req.method,
        path: req.path,
    });

    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid request',
            issues: err.issues,
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    if (err.code && DB_CONNECTION_ERROR_CODES.has(err.code)) {
        return res.status(503).json({
            status: 'error',
            message: 'Database service is currently unavailable. Please try again later.',
        });
    }

    const isProduction = process.env.NODE_ENV === 'production';

    return res.status(500).json({
        status: 'error',
        message: isProduction ? 'Internal Server Error' : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
    });
};
