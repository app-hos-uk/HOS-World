import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPage from '@/app/error';

describe('ErrorPage', () => {
  const mockReset = jest.fn();
  const mockError = new Error('Test error message');

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders error message', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows a generic recovery message without leaking error.message', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/an unexpected error occurred/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();
  });

  it('shows error digest when provided', () => {
    const digestError = Object.assign(new Error('hidden'), { digest: 'abc123' });
    render(<ErrorPage error={digestError} reset={mockReset} />);
    expect(screen.getByText(/Error ID: abc123/i)).toBeInTheDocument();
  });

  it('calls reset when Try Again is clicked', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: /^try again$/i }));
    expect(mockReset).toHaveBeenCalled();
  });
});

