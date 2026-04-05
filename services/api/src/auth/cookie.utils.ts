import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

export const AUTH_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const LOGGED_IN_COOKIE_NAME = 'is_logged_in';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  configService: ConfigService,
) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const frontendUrl = configService.get<string>('FRONTEND_URL') || '';
  const sameSite = isProduction ? 'none' as const : 'lax' as const;

  const accessMaxAge = parseMaxAge(configService.get<string>('JWT_EXPIRES_IN') || '15m');
  const refreshMaxAge = parseMaxAge(configService.get<string>('REFRESH_TOKEN_TTL') || '30d');

  res.cookie(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: refreshMaxAge,
  });

  // Non-HttpOnly cookie so the frontend JS can detect login state
  // without exposing actual tokens
  res.cookie(LOGGED_IN_COOKIE_NAME, 'true', {
    httpOnly: false,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response, configService: ConfigService) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const sameSite = isProduction ? 'none' as const : 'lax' as const;

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
  };

  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
  res.clearCookie(LOGGED_IN_COOKIE_NAME, { ...cookieOptions, httpOnly: false });
}

function parseMaxAge(ttl: string): number {
  const match = ttl.match(/^(\d+)(d|h|m|s)$/);
  if (!match) return 15 * 60 * 1000; // default 15m
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 15 * 60 * 1000;
  }
}
