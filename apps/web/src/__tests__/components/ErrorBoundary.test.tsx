import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPage from '@/app/error';

describe('ErrorPage', () => {
  const mockReset = jest.fn();
  const mockError = new Error('Test error message');

  it('renders error message', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('shows error details', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('calls reset when Try Again is clicked', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText(/try again/i));
    expect(mockReset).toHaveBeenCalled();
  });
});
