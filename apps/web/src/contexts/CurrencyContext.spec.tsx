import { render, screen, waitFor } from '@testing-library/react';
import { CurrencyProvider, useCurrency } from '@/contexts/CurrencyContext';
import {
  DEFAULT_CURRENCY,
  DEFAULT_REGION,
  getRegionConfig,
  setRegionConfig,
} from '@/lib/regionConfig';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const getRegion = jest.fn();
const getCurrencyRates = jest.fn();
const getUserCurrency = jest.fn();
const updateProfile = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getRegion: (...args: unknown[]) => getRegion(...args),
    getCurrencyRates: (...args: unknown[]) => getCurrencyRates(...args),
    getUserCurrency: (...args: unknown[]) => getUserCurrency(...args),
    updateProfile: (...args: unknown[]) => updateProfile(...args),
  },
}));

function Probe() {
  const { currency, locale, formatPrice, regionCurrency } = useCurrency();
  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="region-currency">{regionCurrency}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="price">{formatPrice(19.99)}</span>
    </div>
  );
}

describe('CurrencyProvider region resilience', () => {
  beforeEach(() => {
    setRegionConfig(DEFAULT_REGION);
    localStorage.clear();
    getRegion.mockReset();
    getCurrencyRates.mockReset();
    getUserCurrency.mockReset();
    updateProfile.mockReset();
    getCurrencyRates.mockResolvedValue({ data: { USD: 1, EUR: 0.92 } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to USD/en-US when region fetch fails', async () => {
    getRegion.mockRejectedValue(new Error('network down'));

    render(
      <CurrencyProvider>
        <Probe />
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('currency')).toHaveTextContent(DEFAULT_CURRENCY);
    });

    expect(screen.getByTestId('region-currency')).toHaveTextContent('USD');
    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    expect(getRegionConfig()).toEqual(DEFAULT_REGION);

    const price = screen.getByTestId('price').textContent ?? '';
    expect(price).toMatch(/\$/);
    expect(price).toContain('19.99');
    expect(price).not.toMatch(/NaN|undefined|Invalid/i);
  });

  it('applies a successful region fetch to formatting', async () => {
    getRegion.mockResolvedValue({
      currency: 'EUR',
      country: 'DE',
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
    });

    render(
      <CurrencyProvider>
        <Probe />
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('region-currency')).toHaveTextContent('EUR');
    });

    expect(screen.getByTestId('locale')).toHaveTextContent('de-DE');
    expect(getRegionConfig().currency).toBe('EUR');
  });
});
