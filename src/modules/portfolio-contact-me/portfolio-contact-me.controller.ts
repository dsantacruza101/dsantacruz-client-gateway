import {
  Controller,
  Post,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import {
  ClientProxy,
  RpcException
} from '@nestjs/microservices';
import {
  catchError,
  firstValueFrom,
  throwError
} from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { NATS_SERVICE } from 'src/config';
import { HCaptchaGuard } from 'src/common/guards/hcaptcha.guard';
import { PortfolioContactMeDto } from './dto/portfolio-contact-me.dto';

@Controller('portfolio')
export class PortfolioContactMeController {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @Throttle({ contact: { limit: 3, ttl: 60000 } })
  @UseGuards(HCaptchaGuard)
  @Post('contact-me')
  async sendRegistroRREE(
    @Body() contactMeMessage: PortfolioContactMeDto,
  ) {
    const { captchaToken: _captchaToken, ...payload } = contactMeMessage;

    const registroRREE = await firstValueFrom(
      this.client.send('mail.send', payload).pipe(
        catchError((err) => {
          return throwError(() => new RpcException(err.message));
        }),
      ),
    );

    return registroRREE;
  }
}
