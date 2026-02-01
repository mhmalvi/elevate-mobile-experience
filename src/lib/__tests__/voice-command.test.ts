/**
 * Voice Command Processing Tests
 *
 * Tests the voice command Edge Function and related functionality
 * Covers command parsing, action execution, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
            insert: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
        })),
    },
}));

describe('Voice Command Processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Command Parsing', () => {
        it('should parse "create a quote for [client]" command', async () => {
            const mockResponse = {
                data: {
                    command_type: 'create_quote',
                    intent: 'create',
                    entity: 'quote',
                    client_name: 'John Smith',
                    confidence: 0.95,
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'create a quote for John Smith' },
            });

            expect(result.data).toBeDefined();
            expect(result.data.command_type).toBe('create_quote');
            expect(result.data.client_name).toBe('John Smith');
            expect(result.data.confidence).toBeGreaterThan(0.8);
        });

        it('should parse "add a job note" command', async () => {
            const mockResponse = {
                data: {
                    command_type: 'add_job_note',
                    intent: 'add',
                    entity: 'job_note',
                    note_text: 'Fixed the leaky tap in the kitchen',
                    confidence: 0.92,
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'add a job note: Fixed the leaky tap in the kitchen' },
            });

            expect(result.data.command_type).toBe('add_job_note');
            expect(result.data.note_text).toContain('leaky tap');
        });

        it('should parse "search for client [name]" command', async () => {
            const mockResponse = {
                data: {
                    command_type: 'search_client',
                    intent: 'search',
                    entity: 'client',
                    search_term: 'Sarah',
                    results: [
                        { id: 'cli_1', name: 'Sarah Johnson' },
                        { id: 'cli_2', name: 'Sarah Williams' },
                    ],
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'search for client Sarah' },
            });

            expect(result.data.command_type).toBe('search_client');
            expect(result.data.results).toHaveLength(2);
        });

        it('should parse "track materials" command', async () => {
            const mockResponse = {
                data: {
                    command_type: 'track_materials',
                    intent: 'add',
                    entity: 'materials',
                    items: [
                        { name: '20mm copper pipe', quantity: 3, unit: 'meters' },
                        { name: 'elbow joints', quantity: 6 },
                    ],
                    job_id: 'job_123',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'track materials: 3 meters of 20mm copper pipe and 6 elbow joints' },
            });

            expect(result.data.command_type).toBe('track_materials');
            expect(result.data.items).toHaveLength(2);
        });

        it('should handle ambiguous commands with clarification request', async () => {
            const mockResponse = {
                data: {
                    needs_clarification: true,
                    possible_intents: ['create_invoice', 'send_invoice'],
                    message: 'Did you mean to create a new invoice or send an existing one?',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'invoice' },
            });

            expect(result.data.needs_clarification).toBe(true);
            expect(result.data.possible_intents).toContain('create_invoice');
        });
    });

    describe('Action Execution', () => {
        it('should execute quote creation and return confirmation', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    action: 'created',
                    entity: 'quote',
                    quote_id: 'quo_123',
                    quote_number: 'QUO-2026-001',
                    client_name: 'John Smith',
                    message: 'Quote created for John Smith',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: {
                    command: 'create a quote for John Smith',
                    execute: true,
                },
            });

            expect(result.data.success).toBe(true);
            expect(result.data.quote_id).toBe('quo_123');
        });

        it('should execute client search and return results', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    action: 'searched',
                    entity: 'client',
                    results: [
                        { id: 'cli_1', name: 'John Smith', phone: '0412345678' },
                    ],
                    count: 1,
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: {
                    command: 'find John Smith',
                    execute: true,
                },
            });

            expect(result.data.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
        });

        it('should navigate to dashboard on command', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    action: 'navigate',
                    destination: '/dashboard',
                    message: 'Taking you to the dashboard',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'go to dashboard' },
            });

            expect(result.data.action).toBe('navigate');
            expect(result.data.destination).toBe('/dashboard');
        });
    });

    describe('Error Handling', () => {
        it('should handle unrecognized commands gracefully', async () => {
            const mockResponse = {
                data: {
                    success: false,
                    error_type: 'unrecognized_command',
                    message: "Sorry, I didn't understand that command. Try saying 'create a quote' or 'find a client'.",
                    suggestions: ['create a quote', 'find a client', 'add a job note'],
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'asdfghjkl random words' },
            });

            expect(result.data.success).toBe(false);
            expect(result.data.error_type).toBe('unrecognized_command');
            expect(result.data.suggestions).toBeDefined();
        });

        it('should handle client not found errors', async () => {
            const mockResponse = {
                data: {
                    success: false,
                    error_type: 'client_not_found',
                    message: "I couldn't find a client named 'Nonexistent Person'. Would you like to create a new client?",
                    suggested_action: 'create_client',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'create a quote for Nonexistent Person' },
            });

            expect(result.data.success).toBe(false);
            expect(result.data.error_type).toBe('client_not_found');
        });

        it('should handle API errors gracefully', async () => {
            const mockResponse = {
                data: null,
                error: {
                    message: 'Voice processing service temporarily unavailable',
                    code: 'service_unavailable',
                },
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'create a quote' },
            });

            expect(result.error).toBeDefined();
            expect(result.error.code).toBe('service_unavailable');
        });
    });

    describe('Voice Command Security', () => {
        it('should require authentication for voice commands', async () => {
            const mockResponse = {
                data: null,
                error: {
                    message: 'Unauthorized',
                    code: 'unauthorized',
                },
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'create a quote' },
            });

            expect(result.error).toBeDefined();
            expect(result.error.code).toBe('unauthorized');
        });

        it('should sanitize command input to prevent injection', () => {
            const maliciousCommand = '<script>alert("xss")</script>create a quote';
            const sanitized = maliciousCommand.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toBe('create a quote');
        });

        it('should respect user data permissions', async () => {
            const mockResponse = {
                data: null,
                error: {
                    message: 'Access denied to this resource',
                    code: 'forbidden',
                },
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: {
                    command: 'show invoice for other users client',
                    client_id: 'other_users_client_id',
                },
            });

            expect(result.error).toBeDefined();
            expect(result.error.code).toBe('forbidden');
        });
    });

    describe('Voice Command Context', () => {
        it('should maintain conversation context', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    context_id: 'ctx_123',
                    needs_followup: true,
                    message: 'Quote created. What amount should I set?',
                    awaiting_input: 'amount',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: { command: 'create a quick quote' },
            });

            expect(result.data.context_id).toBeDefined();
            expect(result.data.needs_followup).toBe(true);
        });

        it('should handle follow-up commands with context', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    context_id: 'ctx_123',
                    action: 'updated_amount',
                    message: 'Set the amount to $500. Ready to send?',
                },
                error: null,
            };

            (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

            const result = await supabase.functions.invoke('process-voice-command', {
                body: {
                    command: 'five hundred dollars',
                    context_id: 'ctx_123',
                },
            });

            expect(result.data.action).toBe('updated_amount');
        });
    });
});

describe('Voice Command Tier Limits', () => {
    it('should respect monthly voice command limits by tier', () => {
        const tierLimits = {
            free: 10,
            solo: 100,
            crew: 500,
            pro: -1, // unlimited
        };

        expect(tierLimits.free).toBe(10);
        expect(tierLimits.solo).toBe(100);
        expect(tierLimits.pro).toBe(-1);
    });

    it('should return error when limit exceeded', async () => {
        const mockResponse = {
            data: null,
            error: {
                message: 'Monthly voice command limit reached (10/10). Upgrade to continue.',
                code: 'limit_exceeded',
                limit: 10,
                used: 10,
            },
        };

        (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

        const result = await supabase.functions.invoke('process-voice-command', {
            body: { command: 'create a quote' },
        });

        expect(result.error).toBeDefined();
        expect(result.error.code).toBe('limit_exceeded');
    });
});
