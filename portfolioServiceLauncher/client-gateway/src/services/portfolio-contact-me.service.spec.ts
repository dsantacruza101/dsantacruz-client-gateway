import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioContactMeService } from './portfolio-contact-me.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common/pipes';
import { PortfolioContactMeDto } from './dto/portfolio-contact-me.dto';

describe('PortfolioContactMeService', () => {
  let service: PortfolioContactMeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PortfolioContactMeService],
    }).compile();

    service = module.get<PortfolioContactMeService>(PortfolioContactMeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw an error if the name is empty', async () => {
    const dto: PortfolioContactMeDto = {
      name: '',
      email: 'test@example.com',
      message: 'Test message',
    };

    await expect(service.create(dto)).rejects.toThrowError(
      new HttpException('Name is required', HttpStatus.BAD_REQUEST),
    );
  });

  it('should throw an error if the email is invalid', async () => {
    const dto: PortfolioContactMeDto = {
      name: 'John Doe',
      email: 'invalid-email',
      message: 'Test message',
    };

    await expect(service.create(dto)).rejects.toThrowError(
      new HttpException('Invalid email', HttpStatus.BAD_REQUEST),
    );
  });

  it('should throw an error if the message is empty', async () => {
    const dto: PortfolioContactMeDto = {
      name: 'John Doe',
      email: 'test@example.com',
      message: '',
    };

    await expect(service.create(dto)).rejects.toThrowError(
      new HttpException('Message is required', HttpStatus.BAD_REQUEST),
    );
  });

  it('should create a new contact me entry', async () => {
    const dto: PortfolioContactMeDto = {
      name: 'John Doe',
      email: 'test@example.com',
      message: 'Test message',
    };

    await service.create(dto);
  });
});
