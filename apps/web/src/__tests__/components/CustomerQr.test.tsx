import { render, screen, waitFor } from '@testing-library/react';
import { CustomerQr } from '@/components/CustomerQr';

describe('CustomerQr', () => {
  it('renders nothing without a value', () => {
    const { container } = render(<CustomerQr value="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a data-URL QR and the lookup link', async () => {
    const value = 'https://example.com/ship/lookup?store=demo';
    render(<CustomerQr value={value} size={80} />);
    const img = await waitFor(() => screen.getByAltText('Customer QR'));
    expect(img).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/));
    expect(screen.getByRole('link', { name: value })).toHaveAttribute('href', value);
  });

  it('omits the payload link when showValue is false', async () => {
    const value = '{"t":"hos-loyalty","c":"HOS-TEST"}';
    render(<CustomerQr value={value} size={80} showValue={false} alt="Loyalty card" />);
    await waitFor(() => screen.getByAltText('Loyalty card'));
    expect(screen.queryByRole('link')).toBeNull();
  });
});
