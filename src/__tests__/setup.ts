import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Registers the jest-dom matchers AND their TypeScript declarations.
//
// The previous form — importing the matchers object and calling
// expect.extend(matchers) — worked at runtime but carried no type
// augmentation, so every toBeInTheDocument / toHaveClass / toBeDisabled was a
// type error even though the assertion itself ran fine. The /vitest entrypoint
// does both.
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
