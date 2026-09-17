# Skill: Client Gateway Development

## Cuando usar este skill
Desarrollo, debugging o modificación del client-gateway NestJS.

## Estructura del proyecto
src/
├── main.ts                    — bootstrap de la app
├── app.module.ts              — módulo raíz
└── portfolio-contact-me/      — módulo del formulario
    ├── portfolio-contact-me.module.ts
    ├── portfolio-contact-me.controller.ts  — recibe el POST
    └── portfolio-contact-me.service.ts     — valida hCaptcha y envía via NATS

## Patrones a seguir
- Módulos NestJS estándar con decoradores
- NATS patterns para comunicación entre microservicios
- Validación con class-validator en los DTOs
- Variables de entorno via ConfigModule

## Para agregar un nuevo endpoint
1. Crear módulo en src/<nombre>/
2. Registrarlo en app.module.ts
3. Definir el NATS pattern correspondiente
4. Crear el handler en el microservicio receptor

## Comandos útiles
```bash
npm run build        # compilar
npm run lint         # verificar código
npm run start:dev    # desarrollo local
docker compose up --build -d  # producción via launcher
```

## Verificar que funciona
```bash
curl -X POST https://api.dsantacruz.com/api/portfolio/contact-me
# Debe responder 403 (protegido por hCaptcha)
```