import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { RpcCustomExceptionFilter } from './rpc-custom-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

describe('RpcCustomExceptionFilter', () => {
  let filter: RpcCustomExceptionFilter;
  let response: MockResponse;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter = new RpcCustomExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    host = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ url: '/test', method: 'POST' }),
        getResponse: jest.fn().mockReturnValue(response),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responds with the RPC status and string message when status is valid', () => {
    filter.catch(
      new RpcException({ status: HttpStatus.NOT_FOUND, message: 'Not found' }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      status: HttpStatus.NOT_FOUND,
      message: 'Not found',
      timestamp: expect.any(String) as unknown,
      path: '/test',
    });
  });

  it('responds with 400 when the RPC status is invalid', () => {
    filter.catch(
      new RpcException({ status: 999, message: 'Invalid status' }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      status: HttpStatus.BAD_REQUEST,
      message: 'Invalid status',
      timestamp: expect.any(String) as unknown,
      path: '/test',
    });
  });

  it('responds with the message array when message is a string array', () => {
    const messages = ['email must be an email', 'name should not be empty'];

    filter.catch(
      new RpcException({ status: HttpStatus.BAD_REQUEST, message: messages }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      status: HttpStatus.BAD_REQUEST,
      message: messages,
      timestamp: expect.any(String) as unknown,
      path: '/test',
    });
  });
});
