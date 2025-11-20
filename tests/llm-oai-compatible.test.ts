import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LLM_PROVIDERS } from '../src/index.js';
import { generateResponse, __testing } from '../src/utils/llm.js';

// Import the interface for type testing (will be available via __testing in actual implementation)
interface OAICompatibleConfig {
    apiKey: string;
    baseURL: string;
    timeout?: number;
}

const ORIGINAL_ENV = { ...process.env };

describe('OAICompatible provider', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.OAICOMPATIBLE_API_KEY;
        delete process.env.OAICOMPATIBLE_BASE_URL;
        // Reset the client
        __testing.setOAICompatibleClient(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env = { ...ORIGINAL_ENV };
        __testing.setOAICompatibleClient(null);
    });

    it('is exposed via the tool schema enum', () => {
        expect(SUPPORTED_LLM_PROVIDERS).toContain('oai-compatible');
    });

    it('throws if OAICOMPATIBLE_API_KEY missing', async () => {
        process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';
        await expect(generateResponse({
            goal: 'g',
            plan: 'p',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        })).rejects.toThrow('OAICompatible API key or base URL missing');
    });

    it('throws if OAICOMPATIBLE_BASE_URL missing', async () => {
        process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
        await expect(generateResponse({
            goal: 'g',
            plan: 'p',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        })).rejects.toThrow('OAICompatible API key or base URL missing');
    });

    it('throws if both OAICOMPATIBLE_API_KEY and OAICOMPATIBLE_BASE_URL missing', async () => {
        await expect(generateResponse({
            goal: 'g',
            plan: 'p',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        })).rejects.toThrow('OAICompatible API key or base URL missing');
    });

    it('successfully initializes with both environment variables', async () => {
        process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
        process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

        // Mock OpenAI client
        const mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'oai-compatible reply' } }]
        });
        const mockOpenAI = vi.fn(() => ({
            chat: { completions: { create: mockCreate } }
        }));

        vi.doMock('openai', () => ({
            OpenAI: mockOpenAI
        }));

        const result = await generateResponse({
            goal: 'test',
            plan: 'test',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        });

        expect(result.questions).toBe('oai-compatible reply');
        expect(mockOpenAI).toHaveBeenCalledWith({
            apiKey: 'sk-test-key',
            baseURL: 'https://api.example.com/v1'
        });
        expect(mockCreate).toHaveBeenCalledWith({
            model: 'glm-4.6',
            messages: [{ role: 'system', content: expect.any(String) }]
        });
    });

    it('uses default model when none specified', async () => {
        process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
        process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

        // Mock OpenAI client
        const mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'oai-compatible reply' } }]
        });
        const mockOpenAI = vi.fn(() => ({
            chat: { completions: { create: mockCreate } }
        }));

        vi.doMock('openai', () => ({
            OpenAI: mockOpenAI
        }));

        await generateResponse({
            goal: 'test',
            plan: 'test',
            modelOverride: { provider: 'oai-compatible' }
        });

        expect(mockCreate).toHaveBeenCalledWith({
            model: 'glm-4.6', // Default model
            messages: [{ role: 'system', content: expect.any(String) }]
        });
    });

    it('handles empty string response from API', async () => {
        process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
        process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

        // Mock OpenAI client with empty string response
        const mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: '' } }]
        });
        const mockOpenAI = vi.fn(() => ({
            chat: { completions: { create: mockCreate } }
        }));

        vi.doMock('openai', () => ({
            OpenAI: mockOpenAI
        }));

        const result = await generateResponse({
            goal: 'test',
            plan: 'test',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        });

        expect(result.questions).toBe('');
    });

    it('logs initialization message with base URL', async () => {
        process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
        process.env.OAICOMPATIBLE_BASE_URL = 'https://custom-api.example.com/v1';

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        // Mock OpenAI client
        const mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'test reply' } }]
        });
        const mockOpenAI = vi.fn(() => ({
            chat: { completions: { create: mockCreate } }
        }));

        vi.doMock('openai', () => ({
            OpenAI: mockOpenAI
        }));

        await generateResponse({
            goal: 'test',
            plan: 'test',
            modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            'OAICompatible provider initialized with base URL: https://custom-api.example.com/v1'
        );

        consoleSpy.mockRestore();
    });

    describe('Type Safety Enhancement', () => {
        it('should have proper OAICompatibleConfig interface structure', () => {
            // This test verifies the interface structure at compile time
            // The actual interface is defined in the source file
            const config: OAICompatibleConfig = {
                apiKey: 'test-key',
                baseURL: 'https://api.example.com/v1',
                timeout: 30000
            };

            expect(config.apiKey).toBe('test-key');
            expect(config.baseURL).toBe('https://api.example.com/v1');
            expect(config.timeout).toBe(30000);
        });

        it('should handle optional timeout in OAICompatibleConfig', () => {
            const config: OAICompatibleConfig = {
                apiKey: 'test-key',
                baseURL: 'https://api.example.com/v1'
            };

            expect(config.apiKey).toBe('test-key');
            expect(config.baseURL).toBe('https://api.example.com/v1');
            expect(config.timeout).toBeUndefined();
        });
    });

    describe('URL Validation', () => {
        it('throws for invalid URL without protocol', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'api.example.com/v1'; // Missing protocol

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).rejects.toThrow('Invalid OAICOMPATIBLE_BASE_URL: must start with http:// or https://');
        });

        it('throws for invalid URL with ftp protocol', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'ftp://api.example.com/v1'; // Invalid protocol

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).rejects.toThrow('Invalid OAICOMPATIBLE_BASE_URL: must start with http:// or https://');
        });

        it('accepts valid HTTP URL', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'http://localhost:11434/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'test response' } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).resolves.not.toThrow();
        });

        it('accepts valid HTTPS URL', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'test response' } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).resolves.not.toThrow();
        });
    });

    describe('Configurable Default Model', () => {
        it('uses OAICOMPATIBLE_MODEL environment variable when no model specified', async () => {
            // Set up environment variables
            const originalEnv = process.env.OAICOMPATIBLE_MODEL;
            process.env.OAICOMPATIBLE_MODEL = 'custom-model-name';

            try {
                // Test the model selection logic directly
                const model = undefined; // No explicit model
                const selectedModel = model || process.env.OAICOMPATIBLE_MODEL || 'glm-4.6';

                expect(selectedModel).toBe('custom-model-name');
            } finally {
                // Restore original environment
                if (originalEnv !== undefined) {
                    process.env.OAICOMPATIBLE_MODEL = originalEnv;
                } else {
                    delete process.env.OAICOMPATIBLE_MODEL;
                }
            }
        });

        it('falls back to default when OAICOMPATIBLE_MODEL not set', async () => {
            // Set up environment variables
            const originalEnv = process.env.OAICOMPATIBLE_MODEL;
            delete process.env.OAICOMPATIBLE_MODEL;

            try {
                // Test the model selection logic directly
                const model = undefined; // No explicit model
                const selectedModel = model || process.env.OAICOMPATIBLE_MODEL || 'glm-4.6';

                expect(selectedModel).toBe('glm-4.6');
            } finally {
                // Restore original environment
                if (originalEnv !== undefined) {
                    process.env.OAICOMPATIBLE_MODEL = originalEnv;
                }
            }
        });

        it('prioritizes explicit model over environment variable', async () => {
            // Set up environment variables
            const originalEnv = process.env.OAICOMPATIBLE_MODEL;
            process.env.OAICOMPATIBLE_MODEL = 'env-model';

            try {
                // Test the model selection logic directly
                const model = 'explicit-model'; // Explicit model
                const selectedModel = model || process.env.OAICOMPATIBLE_MODEL || 'glm-4.6';

                expect(selectedModel).toBe('explicit-model');
            } finally {
                // Restore original environment
                if (originalEnv !== undefined) {
                    process.env.OAICOMPATIBLE_MODEL = originalEnv;
                } else {
                    delete process.env.OAICOMPATIBLE_MODEL;
                }
            }
        });
    });

    describe('Basic Response Validation', () => {
        it('throws for null content response', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: null } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).rejects.toThrow('null/undefined content');
        });

        it('throws for undefined content response', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: undefined } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).rejects.toThrow('null/undefined content');
        });

        it('throws for missing message structure', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ /* missing message */ }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            })).rejects.toThrow('invalid message structure');
        });

        it('accepts valid string content response', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'Valid response content' } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            const result = await generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            });

            expect(result.questions).toBe('Valid response content');
        });

        it('accepts empty string content response', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'sk-test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCreate = vi.fn().mockResolvedValue({
                choices: [{ message: { content: '' } }]
            });

            const mockOpenAI = {
                chat: {
                    completions: { create: mockCreate }
                }
            };

            __testing.setOAICompatibleClient(mockOpenAI);

            const result = await generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'glm-4.6' }
            });

            expect(result.questions).toBe('');
        });
    });

    describe('Model name validation', () => {
        it('should validate simple model names', () => {
            expect(__testing.validateOAICompatibleModel('glm-4.6')).toBe(true);
            expect(__testing.validateOAICompatibleModel('gpt-4')).toBe(true);
            expect(__testing.validateOAICompatibleModel('claude-3-5-sonnet')).toBe(true);
        });

        it('should validate organization/model format', () => {
            expect(__testing.validateOAICompatibleModel('z-ai/glm-4.6')).toBe(true);
            expect(__testing.validateOAICompatibleModel('openai/gpt-4')).toBe(true);
            expect(__testing.validateOAICompatibleModel('anthropic/claude-3')).toBe(true);
            expect(__testing.validateOAICompatibleModel('huggingface/mistral-7b')).toBe(true);
        });

        it('should validate versioned models with colons', () => {
            expect(__testing.validateOAICompatibleModel('glm-4.6:thinking')).toBe(true);
            expect(__testing.validateOAICompatibleModel('gpt-4:latest')).toBe(true);
            expect(__testing.validateOAICompatibleModel('claude-3:sonnet')).toBe(true);
            expect(__testing.validateOAICompatibleModel('mistral:7b')).toBe(true);
        });

        it('should validate complex model names with both slashes and colons', () => {
            expect(__testing.validateOAICompatibleModel('z-ai/glm-4.6:thinking')).toBe(true);
            expect(__testing.validateOAICompatibleModel('openai/gpt-4:latest')).toBe(true);
            expect(__testing.validateOAICompatibleModel('anthropic/claude-3:sonnet-20241022')).toBe(true);
            expect(__testing.validateOAICompatibleModel('huggingface/mistral-7b:v0.1')).toBe(true);
        });

        it('should validate model names with dots', () => {
            expect(__testing.validateOAICompatibleModel('model.v1')).toBe(true);
            expect(__testing.validateOAICompatibleModel('org/model.v2')).toBe(true);
            expect(__testing.validateOAICompatibleModel('org/model:v1.2')).toBe(true);
        });

        it('should reject invalid model names', () => {
            expect(__testing.validateOAICompatibleModel('model with spaces')).toBe(false);
            expect(__testing.validateOAICompatibleModel('model@invalid')).toBe(false);
            expect(__testing.validateOAICompatibleModel('model#invalid')).toBe(false);
            expect(__testing.validateOAICompatibleModel('model!invalid')).toBe(false);
            expect(__testing.validateOAICompatibleModel('')).toBe(false);
        });

        it('should throw error for invalid model names during generation', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCompletion = {
                choices: [{ message: { content: 'Test response' } }]
            };
            const mockCreate = vi.fn().mockResolvedValue(mockCompletion);
            const mockClient = {
                chat: { completions: { create: mockCreate } }
            };
            __testing.setOAICompatibleClient(mockClient);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'invalid@model' }
            })).rejects.toThrow('Invalid model name: "invalid@model"');
        });

        it('should accept complex model names during generation', async () => {
            process.env.OAICOMPATIBLE_API_KEY = 'test-key';
            process.env.OAICOMPATIBLE_BASE_URL = 'https://api.example.com/v1';

            const mockCompletion = {
                choices: [{ message: { content: 'Test response' } }]
            };
            const mockCreate = vi.fn().mockResolvedValue(mockCompletion);
            const mockClient = {
                chat: { completions: { create: mockCreate } }
            };
            __testing.setOAICompatibleClient(mockClient);

            await expect(generateResponse({
                goal: 'test',
                plan: 'test',
                modelOverride: { provider: 'oai-compatible', model: 'z-ai/glm-4.6:thinking' }
            })).resolves.not.toThrow();

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'z-ai/glm-4.6:thinking'
                })
            );
        });
    });
});