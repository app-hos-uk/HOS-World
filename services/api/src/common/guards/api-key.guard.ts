import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

export const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers[API_KEY_HEADER];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const validKeys = (this.configService.get<string>('API_KEYS') || '').split(',').filter(Boolean);

    if (validKeys.length === 0) {
      throw new UnauthorizedException('API key authentication not configured');
    }

    if (!validKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
