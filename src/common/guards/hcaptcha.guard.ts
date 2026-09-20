import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { envs } from 'src/config';

interface HCaptchaRequestBody {
  captchaToken?: string;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class HCaptchaGuard implements CanActivate {
  private readonly logger = new Logger(HCaptchaGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request<ParamsDictionary, any, HCaptchaRequestBody>>();
    const token = req.body?.captchaToken;

    if (!token) {
      throw new ForbiddenException('Captcha token is required');
    }

    const params = new URLSearchParams({
      secret: envs.hcaptchaSecret,
      response: token,
    });

    const clientIp = this.extractIp(req);
    if (clientIp) params.append('remoteip', clientIp);

    let data: HCaptchaVerifyResponse;

    try {
      const res = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        body: params,
      });
      data = (await res.json()) as HCaptchaVerifyResponse;
    } catch (err) {
      this.logger.error('hCaptcha network error', err);
      throw new ForbiddenException('Captcha verification unavailable');
    }

    if (!data.success) {
      this.logger.warn(
        `hCaptcha rejected: ${JSON.stringify(data['error-codes'])}`,
      );
      throw new ForbiddenException('Captcha verification failed');
    }

    return true;
  }

  private extractIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'] as string;
    const xRealIp = req.headers['x-real-ip'] as string;

    let ip = '';
    if (xForwardedFor) {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (xRealIp) {
      ip = xRealIp;
    } else {
      ip = req.ip || req.socket.remoteAddress || '';
    }

    return ip.includes('::ffff:') ? ip.split(':').pop() || '' : ip;
  }
}
