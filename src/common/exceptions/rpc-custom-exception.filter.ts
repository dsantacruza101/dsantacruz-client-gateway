import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { 
  EMPTY_RESPONSE_REGEX, 
  VALID_HTTP_STATUSES 
} from '../constants/rpc-exception.constants';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {

  private readonly logger = new Logger(RpcCustomExceptionFilter.name);

  catch(exception: RpcException, host: ArgumentsHost) {
    // Guard: this filter only handles HTTP contexts
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const rpcError = exception.getError();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (typeof rpcError === 'string') {
      if (EMPTY_RESPONSE_REGEX.test(rpcError)) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service temporarily unavailable';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = rpcError;
      }
    } else if (typeof rpcError === 'object' && rpcError !== null) {
      const errObj = rpcError as Record<string, any>;

      const rawStatus = errObj.status;
      status = typeof rawStatus === 'number' && VALID_HTTP_STATUSES.has(rawStatus)
        ? rawStatus
        : HttpStatus.BAD_REQUEST;

      const rawMessage = errObj.message;
      if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else if (Array.isArray(rawMessage) && rawMessage.every((m) => typeof m === 'string')) {
        message = rawMessage; // class-validator returns string[]
      }
    }

    this.logger.error(
      `RPC Exception on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? 'unknown'}: ${JSON.stringify(message)} (status: ${status})`,
      exception.stack,
    );

    return response.status(status).json({
      status,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url ?? 'unknown',
    });
  }
}