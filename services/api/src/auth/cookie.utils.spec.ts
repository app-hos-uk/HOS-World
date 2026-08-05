import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  LOGGED_IN_COOKIE_NAME,
  clearAuthCookies,
  setAuthCookies,
} from './cookie.utils';

describe('cookie.utils', () => {
  const mockRes = () => {
    const cookies: Record<string, unknown> = {};
    const cleared: string[] = [];
    return {
      cookie: jest.fn((name: string, value: string, options: unknown) => {
        cookies[name] = { value, options };
      }),
      clearCookie: jest.fn((name: string) => {
        cleared.push(name);
      }),
      cookies,
      cleared,
    } as unknown as Response & { cookies: Record<string, unknown>; cleared: string[] };
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'REFRESH_TOKEN_TTL') return '30d';
      return undefined;
    }),
  } as unknown as ConfigService;

  it('setAuthCookies writes access, refresh, and logged-in cookies', () => {
    const res = mockRes();

    setAuthCookies(res, 'access-token', 'refresh-token', config);

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'access-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      LOGGED_IN_COOKIE_NAME,
      'true',
      expect.objectContaining({ httpOnly: false }),
    );
  });

  it('clearAuthCookies clears all auth cookies', () => {
    const res = mockRes();

    clearAuthCookies(res, config);

    expect(res.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith(LOGGED_IN_COOKIE_NAME, expect.any(Object));
  });

  it('uses secure + SameSite=None cookies in production', () => {
    const prodConfig = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_EXPIRES_IN') return '1h';
        if (key === 'REFRESH_TOKEN_TTL') return '7d';
        return undefined;
      }),
    } as unknown as ConfigService;
    const res = mockRes();

    setAuthCookies(res, 'a', 'r', prodConfig);

    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'a',
      expect.objectContaining({ secure: true, sameSite: 'none' }),
    );
  });
});
