import { ForbiddenException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { envs } from 'src/config';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {

  private readonly logger = new Logger('SecurityMiddleware');
  private readonly allowedDomains = new Set(envs.corsAllowedOriginDomains);
  private readonly isDevelopment = envs.corsEnv === 'development';

  use(req: Request, res: Response, next: NextFunction) {
    if (this.isDevelopment) {
      return next();
    }

    const origin = req.get('origin') || '';

    if (!this.allowedDomains.has(origin)) {
      this.logger.warn(`Access denied — Origin: ${origin || 'N/A'}`);
      throw new ForbiddenException('Access denied.');
    }

    next();
  }
}
