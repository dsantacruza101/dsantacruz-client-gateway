import { ForbiddenException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { envs } from 'src/config';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {

  private readonly logger = new Logger('SecurityMiddleware');
  private readonly allowedIps = envs.corsAllowedOriginIPs;
  private readonly allowedDomains = envs.corsAllowedOriginDomains;
  private readonly isDevelopment = envs.corsEnv;

  use(req: Request, res: Response, next: NextFunction) {

    // Si estamos en desarrollo y la petición es local, saltamos la validación
    // Opcional: Solo si quieres total libertad en local
    if (this.isDevelopment === 'development') {
        return next();
    }

    // 1. Ver qué headers están llegando (Depuración total)
    // Esto imprimirá en la consola de Docker todos los headers que Nginx inyecta
    console.log('Headers recibidos en Nest:', req.headers);

    // 2. Intentar obtenerlo de varias fuentes comunes
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    const xRealIp = req.headers['x-real-ip'] as string;

    let clientIp = '';

    if (xForwardedFor) {
      clientIp = xForwardedFor.split(',')[0].trim();
    } else if (xRealIp) {
      clientIp = xRealIp;
    } else {
      clientIp = req.ip || req.socket.remoteAddress || '';
    }

    // Limpieza de IPv6...
    if (clientIp.includes('::ffff:')) {
      clientIp = clientIp.split(':').pop() || '';
    }

    this.logger.debug(`Validando IP: ${clientIp}`);

    const origin = req.get('origin') || '';

    // 3. Validaciones
    const isIpAllowed = this.allowedIps.includes(clientIp);
    const isDomainAllowed = this.allowedDomains.includes(origin);

    if (!isIpAllowed && !isDomainAllowed) {
      // El log ahora te mostrará tu IP real
      this.logger.warn(`🚫 Acceso Denegado: IP=${clientIp}, Origin=${origin || 'N/A'}`);
      throw new ForbiddenException('No tienes permiso para acceder a este recurso.');
    }

    next();
  }
}
