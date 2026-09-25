import { describe, it, expect } from 'vitest';
import { DEFAULT_FROM_ADDRESS, fromHeader, sanitizeDisplayName } from './email-sender';

describe('fromHeader', () => {
  it('sends from the verified TradieMate address, not the Resend sandbox', () => {
    // Arrange
    const businessName = 'Acme Plumbing';

    // Act
    const header = fromHeader(businessName);

    // Assert
    expect(header).toBe(`Acme Plumbing <${DEFAULT_FROM_ADDRESS}>`);
    expect(header).not.toContain('resend.dev');
  });

  it('accepts an explicit address override', () => {
    // Arrange / Act
    const header = fromHeader('Acme', 'billing@example.com');

    // Assert
    expect(header).toBe('Acme <billing@example.com>');
  });
});

describe('sanitizeDisplayName', () => {
  it.each([
    ['Evil <attacker@x.com>\r\nBcc: victim@y.com', 'Evil attacker@x.comBcc: victim@y.com'],
    ['"Quoted" Name', 'Quoted Name'],
    ['   ', 'TradieMate'],
    [null, 'TradieMate'],
  ])('neutralises %j', (input, expected) => {
    // Arrange / Act
    const name = sanitizeDisplayName(input);

    // Assert
    expect(name).toBe(expected);
  });

  it('caps very long names at 64 characters', () => {
    // Arrange
    const longName = 'x'.repeat(200);

    // Act
    const name = sanitizeDisplayName(longName);

    // Assert
    expect(name).toHaveLength(64);
  });
});
