import { Module } from '@nestjs/common';
import { PortfolioContactMeController } from './portfolio-contact-me.controller';
import { NatsModule } from 'src/transport/nats.module';

@Module({
  controllers: [PortfolioContactMeController],
  imports: [NatsModule],
})
export class PortfolioContactMeModule {}
