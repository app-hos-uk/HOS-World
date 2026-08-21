import { AccessModeService } from './access-mode.service';

function svc(env: Record<string, string | undefined>) {
  return new AccessModeService({
    get: (key: string) => env[key],
  } as any);
}

describe('AccessModeService', () => {
  it('defaults to legacy', () => {
    const s = svc({});
    expect(s.getGlobalMode()).toBe('legacy');
    expect(s.getModuleMode('orders')).toBe('legacy');
    expect(s.getDataScopeMode()).toBe('legacy');
  });

  it('honours per-module overrides', () => {
    const s = svc({
      ACCESS_CONTROL_MODE: 'shadow',
      ACCESS_CONTROL_MODULE_MODES: 'orders:enforce,finance:legacy',
      ACCESS_CONTROL_DATA_SCOPE: 'shadow',
    });
    expect(s.getGlobalMode()).toBe('shadow');
    expect(s.getModuleMode('orders')).toBe('enforce');
    expect(s.getModuleMode('finance')).toBe('legacy');
    expect(s.getModuleMode('sellers')).toBe('shadow');
    expect(s.getDataScopeMode()).toBe('shadow');
  });
});
