import { 
  Controller, 
  Post, 
  Body, 
  Inject, 
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
import { NATS_SERVICE } from 'src/config';
import { PortfolioContactMeDto } from './dto/portfolio-contact-me.dto';

@Controller('portfolio')
export class PortfolioContactMeController {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  @Post('contact-me')
  async sendRegistroRREE(
    @Body() contactMeMessage: PortfolioContactMeDto,
  ) {
    const payload = {
      ...contactMeMessage,
    };
    
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
