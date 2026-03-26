/**
 * Tests for the ErrorBoundary component.
 *
 * We use a helper component that conditionally throws so we can test both the
 * happy path (children rendered normally) and the error path (fallback UI shown).
 *
 * React 18 calls console.error when an error boundary catches an error, so we
 * suppress that output in tests to keep the terminal clean.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A component that throws when `shouldThrow` is true.
 * Renders a button so tests can trigger a throw after mount.
 */
function Bomb({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div>Child content is safe</div>;
}

/**
 * A component whose parent can toggle it into a throwing state.
 */
function ToggleBomb() {
  const [blow, setBlow] = useState(false);
  if (blow) {
    throw new Error('Toggle explosion');
  }
  return (
    <button onClick={() => setBlow(true)}>Blow up</button>
  );
}

// Silence React's built-in error-boundary console.error output during tests.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorBoundary — children render normally', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content is safe')).toBeInTheDocument();
  });

  it('does not show the error UI when children are healthy', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary — shows default fallback UI on error', () => {
  it('shows the default "Something went wrong" heading when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
  });

  it('shows "Try Again" and "Go Home" action buttons', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('hides the children content when an error has occurred', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Child content is safe')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary — custom fallback', () => {
  it('renders the custom fallback instead of the default UI when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error screen</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error screen')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /something went wrong/i })).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary — onError callback', () => {
  it('calls the onError prop when a child throws', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledOnce();
    const [error, errorInfo] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test explosion');
    expect(errorInfo).toHaveProperty('componentStack');
  });
});

describe('ErrorBoundary — recovery via "Try Again"', () => {
  it('renders children again after the "Try Again" button is clicked', async () => {
    /**
     * We need a parent that can re-render the boundary with a non-throwing child
     * after the user clicks "Try Again". The simplest approach is to wrap
     * ErrorBoundary in a stateful component that controls whether <Bomb> throws.
     */
    function RecoveryWrapper() {
      const [shouldThrow, setShouldThrow] = useState(true);

      return (
        <ErrorBoundary
          onError={() => {
            // After the boundary catches the error, switch off the throw so the
            // recovered render succeeds.
            setShouldThrow(false);
          }}
        >
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<RecoveryWrapper />);

    // Error UI is visible
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();

    // Click "Try Again" — the boundary resets its state
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Children are now rendered without throwing
    expect(screen.getByText('Child content is safe')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /something went wrong/i })).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary — error triggered by user interaction', () => {
  it('catches an error thrown inside an event handler child component', async () => {
    render(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>
    );

    // Before the explosion, children are healthy
    expect(screen.getByRole('button', { name: /blow up/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /blow up/i }));

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
  });
});
