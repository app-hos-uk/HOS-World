import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FacebookAuthGuard extends AuthGuard('facebook') {
  canActivate(context: ExecutionContext) {
    try {
      return super.canActivate(context);
    } catch (error) {
      // Strategy not registered - OAuth not configured
      return true; // Allow request, controller should handle missing OAuth
    }
  }
}
