# Client Gateway — Contexto

## Qué es
API Gateway principal del portafolio. Recibe requests externos y los enruta via NATS a los microservicios internos.

## Stack
- NestJS + TypeScript
- NATS (TLS) como message broker
- Puerto: 3000
- Dockerfile: dockerfile.prod (multi-stage build)

## Endpoints
- POST /api/portfolio/contact-me — formulario de contacto (protegido con hCaptcha)

## Variables de entorno requeridas
- PORT: 3000
- NATS_SERVERS: tls://nats-server:4222
- NATS_TOKEN: secret
- NODE_EXTRA_CA_CERTS: /certs/ca.crt (certificado TLS para NATS)
- CORS_ENV: production
- CORS_ALLOW_DOMAINS: dsantacruz.dev,dsantacruz.com
- HCAPTCHA_SECRET: en /etc/telegram-bot.env del servidor

## Arquitectura