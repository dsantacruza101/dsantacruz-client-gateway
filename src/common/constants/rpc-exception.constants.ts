import { HttpStatus } from '@nestjs/common';

export const VALID_HTTP_STATUSES = new Set(
  Object.values(HttpStatus).filter((v): v is number => typeof v === 'number'),
);

// Matches NestJS "Empty response" errors without relying on the full message wording
export const EMPTY_RESPONSE_REGEX = /^Empty response/i;
