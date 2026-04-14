import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { NatsModule } from './transport/nats.module';
import { PortfolioContactMeModule } from './modules/portfolio-contact-me/portfolio-contact-me.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SecurityMiddleware } from './middleware/security-middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 1000,
        limit: 5,
        // blockDuration: 5000,
      },
    ]),
    PortfolioContactMeModule, 
    NatsModule
  ],
  providers:[
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ]
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
      consumer.apply(SecurityMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
