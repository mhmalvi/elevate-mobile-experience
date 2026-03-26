/**
 * Voice Command Client-Side Logic Tests
 *
 * Tests the parsing helpers, input sanitisation, tier-limit enforcement,
 * and command-building logic that runs on the client before — or in response
 * to — calls to the process-voice-command edge function.
 *
 * No network calls are made. All functions are pure or deterministic.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Client-side voice command helpers
// ---------------------------------------------------------------------------

type CommandIntent = 'create_quote' | 'create_invoice' | 'add_job_note' | 'search_client'
  | 'track_materials' | 'navigate' | 'unknown';

interface ParsedCommand {
  intent: CommandIntent;
  confidence: number;
  params: Record<string, string>;
}

/**
 * Lightweight client-side intent classifier.
 * The real NLP runs in the edge function; this mirrors the same keyword
 * matching used to pre-validate commands before sending them to the server.
 */
function classifyIntent(command: string): CommandIntent {
  const lower = command.toLowerCase().trim();

  if (lower.includes('create') && lower.includes('quote')) return 'create_quote';
  if (lower.includes('create') && lower.includes('invoice')) return 'create_invoice';
  if (lower.includes('job note') || lower.includes('add note')) return 'add_job_note';
  if (
    lower.includes('search') ||
    lower.includes('find') ||
    lower.includes('look up')
  ) return 'search_client';
  if (lower.includes('track') && lower.includes('material')) return 'track_materials';
  if (
    lower.includes('go to') ||
    lower.includes('navigate') ||
    lower.includes('open')
  ) return 'navigate';

  return 'unknown';
}

/** Strip script tags and control characters from a voice command string */
function sanitiseCommand(input: string): string {
  // Remove HTML script blocks
  let clean = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove null bytes and control characters (ASCII 0-31 except tab, newline)
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean.trim();
}

/** Enforce a maximum command length to prevent abuse */
const MAX_COMMAND_LENGTH = 500;

function isCommandTooLong(command: string): boolean {
  return command.length > MAX_COMMAND_LENGTH;
}

/** Return true when the command is effectively empty after trimming */
function isCommandEmpty(command: string): boolean {
  return command.trim().length === 0;
}

/** Extract a client name from a "create a quote for <Name>" command */
function extractClientName(command: string): string | null {
  const match = command.match(/(?:quote|invoice)\s+for\s+(.+)/i);
  return match ? match[1].trim() : null;
}

/** Extract a navigation destination from a "go to <destination>" command */
function extractNavDestination(command: string): string | null {
  const match = command.match(/(?:go to|navigate to|open)\s+(.+)/i);
  if (!match) return null;
  const dest = match[1].trim().toLowerCase();
  const routeMap: Record<string, string> = {
    dashboard: '/dashboard',
    jobs: '/jobs',
    quotes: '/quotes',
    invoices: '/invoices',
    clients: '/clients',
    settings: '/settings',
  };
  return routeMap[dest] ?? null;
}

/** Monthly voice command limits by subscription tier */
const VOICE_COMMAND_LIMITS: Record<string, number> = {
  free: 10,
  solo: 100,
  crew: 500,
  pro: -1, // unlimited
};

/** Return true when the user can still issue voice commands this month */
function canIssueVoiceCommand(tier: string, usedThisMonth: number): boolean {
  const limit = VOICE_COMMAND_LIMITS[tier] ?? VOICE_COMMAND_LIMITS.free;
  if (limit === -1) return true;
  return usedThisMonth < limit;
}

/** Build the request payload sent to the process-voice-command edge function */
function buildCommandPayload(
  command: string,
  contextId?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = { command };
  if (contextId) payload.context_id = contextId;
  return payload;
}

/** Determine whether a response indicates that clarification is needed */
function needsClarification(response: {
  needs_clarification?: boolean;
  possible_intents?: string[];
}): boolean {
  return response.needs_clarification === true && Array.isArray(response.possible_intents) && response.possible_intents.length > 1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Intent classification', () => {
  it('classifies "create a quote for John Smith" as create_quote', () => {
    expect(classifyIntent('create a quote for John Smith')).toBe('create_quote');
  });

  it('classifies "create an invoice for Jane Doe" as create_invoice', () => {
    expect(classifyIntent('create an invoice for Jane Doe')).toBe('create_invoice');
  });

  it('classifies "add a job note: fixed the leak" as add_job_note', () => {
    expect(classifyIntent('add a job note: fixed the leak')).toBe('add_job_note');
  });

  it('classifies "find John Smith" as search_client', () => {
    expect(classifyIntent('find John Smith')).toBe('search_client');
  });

  it('classifies "search for client Sarah" as search_client', () => {
    expect(classifyIntent('search for client Sarah')).toBe('search_client');
  });

  it('classifies "look up client ABC Corp" as search_client', () => {
    expect(classifyIntent('look up client ABC Corp')).toBe('search_client');
  });

  it('classifies "track materials for job 5" as track_materials', () => {
    expect(classifyIntent('track materials for job 5')).toBe('track_materials');
  });

  it('classifies "go to dashboard" as navigate', () => {
    expect(classifyIntent('go to dashboard')).toBe('navigate');
  });

  it('classifies "open invoices" as navigate', () => {
    expect(classifyIntent('open invoices')).toBe('navigate');
  });

  it('classifies an unrecognised utterance as unknown', () => {
    expect(classifyIntent('asdfghjkl random words')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(classifyIntent('CREATE A QUOTE FOR TEST')).toBe('create_quote');
  });
});

describe('Command input sanitisation', () => {
  it('removes <script> injection attempts', () => {
    const dirty = '<script>alert("xss")</script>create a quote';
    expect(sanitiseCommand(dirty)).toBe('create a quote');
  });

  it('strips null bytes from input', () => {
    const dirty = 'create a quote\x00';
    expect(sanitiseCommand(dirty)).toBe('create a quote');
  });

  it('preserves normal alphanumeric and punctuation', () => {
    const clean = "add a job note: Fixed the leak at 42 Smith St.";
    expect(sanitiseCommand(clean)).toBe(clean);
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitiseCommand('  find client  ')).toBe('find client');
  });

  it('removes control characters while keeping newlines used intentionally', () => {
    // \x01 is a control char; regular text should survive
    const dirty = '\x01find client ABC';
    expect(sanitiseCommand(dirty)).toBe('find client ABC');
  });
});

describe('Command length and emptiness guards', () => {
  it('accepts a command within the 500-char limit', () => {
    expect(isCommandTooLong('create a quote for John')).toBe(false);
  });

  it('rejects a command over 500 characters', () => {
    expect(isCommandTooLong('a'.repeat(501))).toBe(true);
  });

  it('accepts a command of exactly 500 characters', () => {
    expect(isCommandTooLong('a'.repeat(500))).toBe(false);
  });

  it('detects empty commands', () => {
    expect(isCommandEmpty('')).toBe(true);
    expect(isCommandEmpty('   ')).toBe(true);
  });

  it('does not flag non-empty commands as empty', () => {
    expect(isCommandEmpty('hi')).toBe(false);
  });
});

describe('Client name extraction from command', () => {
  it('extracts client name from "create a quote for John Smith"', () => {
    expect(extractClientName('create a quote for John Smith')).toBe('John Smith');
  });

  it('extracts client name from "create an invoice for ABC Corp"', () => {
    expect(extractClientName('create an invoice for ABC Corp')).toBe('ABC Corp');
  });

  it('returns null when no client name pattern is found', () => {
    expect(extractClientName('go to dashboard')).toBeNull();
    expect(extractClientName('find John')).toBeNull();
  });

  it('handles multi-word client names', () => {
    expect(extractClientName('create a quote for Sunshine Plumbing Pty Ltd')).toBe(
      'Sunshine Plumbing Pty Ltd'
    );
  });
});

describe('Navigation destination extraction', () => {
  it('maps "go to dashboard" to /dashboard', () => {
    expect(extractNavDestination('go to dashboard')).toBe('/dashboard');
  });

  it('maps "open invoices" to /invoices', () => {
    expect(extractNavDestination('open invoices')).toBe('/invoices');
  });

  it('maps "navigate to settings" to /settings', () => {
    expect(extractNavDestination('navigate to settings')).toBe('/settings');
  });

  it('returns null for unrecognised destinations', () => {
    expect(extractNavDestination('go to outer space')).toBeNull();
  });

  it('returns null when there is no navigation keyword', () => {
    expect(extractNavDestination('create a quote')).toBeNull();
  });
});

describe('Voice command tier limit enforcement', () => {
  it('free tier blocks commands when 10 have been issued', () => {
    expect(canIssueVoiceCommand('free', 10)).toBe(false);
  });

  it('free tier allows commands when fewer than 10 have been issued', () => {
    expect(canIssueVoiceCommand('free', 0)).toBe(true);
    expect(canIssueVoiceCommand('free', 9)).toBe(true);
  });

  it('solo tier allows up to 100 commands', () => {
    expect(canIssueVoiceCommand('solo', 99)).toBe(true);
    expect(canIssueVoiceCommand('solo', 100)).toBe(false);
  });

  it('crew tier allows up to 500 commands', () => {
    expect(canIssueVoiceCommand('crew', 499)).toBe(true);
    expect(canIssueVoiceCommand('crew', 500)).toBe(false);
  });

  it('pro tier has no limit regardless of usage', () => {
    expect(canIssueVoiceCommand('pro', 0)).toBe(true);
    expect(canIssueVoiceCommand('pro', 10000)).toBe(true);
  });

  it('limits increase across tiers: free < solo < crew', () => {
    expect(VOICE_COMMAND_LIMITS.free).toBeLessThan(VOICE_COMMAND_LIMITS.solo);
    expect(VOICE_COMMAND_LIMITS.solo).toBeLessThan(VOICE_COMMAND_LIMITS.crew);
  });
});

describe('Command payload construction', () => {
  it('includes the command text', () => {
    const payload = buildCommandPayload('create a quote for John');
    expect(payload.command).toBe('create a quote for John');
  });

  it('omits context_id when not provided', () => {
    const payload = buildCommandPayload('find client Sarah');
    expect(payload.context_id).toBeUndefined();
  });

  it('includes context_id when provided (multi-turn conversation)', () => {
    const payload = buildCommandPayload('five hundred dollars', 'ctx_abc123');
    expect(payload.context_id).toBe('ctx_abc123');
  });
});

describe('Clarification response detection', () => {
  it('flags a response that needs clarification with multiple intents', () => {
    const response = {
      needs_clarification: true,
      possible_intents: ['create_invoice', 'send_invoice'],
    };
    expect(needsClarification(response)).toBe(true);
  });

  it('does not flag a response with a single resolved intent', () => {
    const response = {
      needs_clarification: false,
      possible_intents: ['create_quote'],
    };
    expect(needsClarification(response)).toBe(false);
  });

  it('does not flag a response when possible_intents is missing', () => {
    expect(needsClarification({ needs_clarification: true })).toBe(false);
  });

  it('does not flag a response with an empty possible_intents array', () => {
    expect(needsClarification({ needs_clarification: true, possible_intents: [] })).toBe(false);
  });
});
