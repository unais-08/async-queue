import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';

export const asyncHandler = <P = Record<string, string>>(
  fn: RequestHandler<P>
): RequestHandler<P> =>
  (
    req: Request<P>,
    res: Response,
    next: NextFunction
  ) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };