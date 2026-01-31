import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if Google OAuth is configured by checking if strategy exists
    // If not configured, allow request to pass (OAuth endpoints will return 501)
    try {
      return super.canActivate(context);
    } catch (error) {
      // Strategy not registered - OAuth not configured
      return true; // Allow request, controller should handle missing OAuth
    }
  }
}
