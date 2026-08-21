import { Injectable, NestMiddleware } from '@nestjs/common';
import {
  accessControlStorage,
  emptyAccessControlStore,
  type AccessControlStore,
} from './access-control.als';

/**
 * Opens one AsyncLocalStorage scope per request, before guards run, holding a
 * mutable placeholder store. AccessGuard fills that store in once it has
 * resolved the market context.
 *
 * The scope has to be opened here rather than in a guard or interceptor: only
 * middleware wraps the entire request lifecycle, so the context survives
 * streaming responses and every `await` in the handler chain.
 */
@Injectable()
export class AccessControlMiddleware implements NestMiddleware {
  use(req: Record<string, unknown>, _res: unknown, next: () => void): void {
    const store: AccessControlStore = emptyAccessControlStore();
    req.accessControlStore = store;
    accessControlStorage.run(store, () => next());
  }
}
