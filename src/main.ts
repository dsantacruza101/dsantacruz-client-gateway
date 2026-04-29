import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Response } from 'express';
import * as express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { envs } from './config';
import { RpcCustomExceptionFilter } from './common/exceptions/rpc-custom-exception.filter';

async function bootstrap() {
  const logger = new Logger('Main-Gateway');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Network / proxy configuration
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers (Helmet)
  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Additional security-related headers
  app.use((_req: unknown, res: Response, next: () => void) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'geolocation=(), camera=()');
    next();
  });

  // Global configuration
  app.setGlobalPrefix('api');

  // Body parsing with explicit limits
  app.use(
    express.json({
      limit: '10mb',
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    }),
  );

  // Global validation & exception handling
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((err) =>
          Object.values(err.constraints ?? {}),
        );
        logger.warn(`Validation failed. Messages: ${JSON.stringify(messages)}`);
        return new BadRequestException({
          statusCode: 400,
          message: messages, // Sugerencia: enviarlos para facilitar el desarrollo
          error: 'Bad Request',
        });
      },
    }),
  );

  app.useGlobalFilters(new RpcCustomExceptionFilter());

  const allowedOrigins = new Set(envs.corsAllowedOriginDomains);

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET, POST',
    allowedHeaders: [
      'Content-Type',
      'X-Requested-With',
    ],
    credentials: false,
    maxAge: 86400,
  });

  await app.listen(envs.port);
  logger.log(`Gateway running and ready`);
}
bootstrap();
