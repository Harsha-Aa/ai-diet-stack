/**
 * Unit tests for secrets management utilities
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
} from '@aws-sdk/client-ssm';
import {
  getDatabaseCredentials,
  getJwtSecret,
  getEncryptionKey,
  getStripeApiKey,
  getDexcomApiCredentials,
  getLibreApiCredentials,
  getBedrockModelId,
  getBedrockRegion,
  getSesFromEmail,
  getApiRateLimit,
  getSessionTimeoutMinutes,
  getFreeTierLimits,
  getAllConfigParameters,
  clearSecretsCache,
  getSecretWithRetry,
  DatabaseCredentials,
  CgmApiCredentials,
  FreeTierLimits,
} from '../src/shared/secrets';

// Mock AWS SDK clients
const secretsManagerMock = mockClient(SecretsManagerClient);
const ssmMock = mockClient(SSMClient);

describe('Secrets Management', () => {
  beforeEach(() => {
    // Reset mocks before each test
    secretsManagerMock.reset();
    ssmMock.reset();
    
    // Clear cache before each test
    clearSecretsCache();
    
    // Set test environment
    process.env.ENVIRONMENT = 'dev';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.ENVIRONMENT;
  });

  describe('Secrets Manager - Sensitive Data', () => {
    describe('getDatabaseCredentials', () => {
      it('should retrieve database credentials', async () => {
        const mockCredentials: DatabaseCredentials = {
          username: 'admin',
          password: 'test-password-123',
          engine: 'postgres',
          host: 'localhost',
          port: 5432,
          dbname: 'aidiet',
        };

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: JSON.stringify(mockCredentials),
        });

        const result = await getDatabaseCredentials();

        expect(result).toEqual(mockCredentials);
        expect(secretsManagerMock.calls()).toHaveLength(1);
      });

      it('should throw error if secret is empty', async () => {
        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: undefined,
        });

        await expect(getDatabaseCredentials()).rejects.toThrow(
          'Database credentials secret is empty'
        );
      });

      it('should cache credentials on subsequent calls', async () => {
        const mockCredentials: DatabaseCredentials = {
          username: 'admin',
          password: 'test-password-123',
          engine: 'postgres',
        };

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: JSON.stringify(mockCredentials),
        });

        // First call
        await getDatabaseCredentials();
        
        // Second call (should use cache)
        const result = await getDatabaseCredentials();

        expect(result).toEqual(mockCredentials);
        expect(secretsManagerMock.calls()).toHaveLength(1); // Only one API call
      });
    });

    describe('getJwtSecret', () => {
      it('should retrieve JWT secret', async () => {
        const mockSecret = 'test-jwt-secret-64-characters-long-for-security-purposes-abc123';

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: mockSecret,
        });

        const result = await getJwtSecret();

        expect(result).toBe(mockSecret);
      });

      it('should throw error if JWT secret is empty', async () => {
        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: undefined,
        });

        await expect(getJwtSecret()).rejects.toThrow('JWT secret is empty');
      });
    });

    describe('getEncryptionKey', () => {
      it('should retrieve encryption key', async () => {
        const mockKey = 'test-encryption-key-64-characters-long-for-aes-256-encryption-abc';

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: mockKey,
        });

        const result = await getEncryptionKey();

        expect(result).toBe(mockKey);
      });
    });

    describe('getStripeApiKey', () => {
      it('should retrieve Stripe API key', async () => {
        const mockKey = 'sk_test_1234567890abcdefghijklmnop';

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: mockKey,
        });

        const result = await getStripeApiKey();

        expect(result).toBe(mockKey);
      });
    });

    describe('getDexcomApiCredentials', () => {
      it('should retrieve Dexcom API credentials', async () => {
        const mockCredentials: CgmApiCredentials = {
          clientId: 'dexcom-client-id',
          clientSecret: 'dexcom-client-secret',
          redirectUri: 'https://api.aidiet.app/cgm/dexcom/callback',
        };

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: JSON.stringify(mockCredentials),
        });

        const result = await getDexcomApiCredentials();

        expect(result).toEqual(mockCredentials);
      });
    });

    describe('getLibreApiCredentials', () => {
      it('should retrieve Libre API credentials', async () => {
        const mockCredentials: CgmApiCredentials = {
          clientId: 'libre-client-id',
          clientSecret: 'libre-client-secret',
          redirectUri: 'https://api.aidiet.app/cgm/libre/callback',
        };

        secretsManagerMock.on(GetSecretValueCommand).resolves({
          SecretString: JSON.stringify(mockCredentials),
        });

        const result = await getLibreApiCredentials();

        expect(result).toEqual(mockCredentials);
      });
    });
  });

  describe('Parameter Store - Non-Sensitive Configuration', () => {
    describe('getBedrockModelId', () => {
      it('should retrieve Bedrock model ID', async () => {
        const mockModelId = 'anthropic.claude-3-sonnet-20240229-v1:0';

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: mockModelId,
          },
        });

        const result = await getBedrockModelId();

        expect(result).toBe(mockModelId);
      });

      it('should throw error if parameter is empty', async () => {
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: undefined,
          },
        });

        await expect(getBedrockModelId()).rejects.toThrow(
          'Bedrock model ID parameter is empty'
        );
      });
    });

    describe('getBedrockRegion', () => {
      it('should retrieve Bedrock region', async () => {
        const mockRegion = 'us-east-1';

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: mockRegion,
          },
        });

        const result = await getBedrockRegion();

        expect(result).toBe(mockRegion);
      });
    });

    describe('getSesFromEmail', () => {
      it('should retrieve SES from email', async () => {
        const mockEmail = 'noreply@aidiet.app';

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: mockEmail,
          },
        });

        const result = await getSesFromEmail();

        expect(result).toBe(mockEmail);
      });
    });

    describe('getApiRateLimit', () => {
      it('should retrieve API rate limit as number', async () => {
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: '100',
          },
        });

        const result = await getApiRateLimit();

        expect(result).toBe(100);
        expect(typeof result).toBe('number');
      });
    });

    describe('getSessionTimeoutMinutes', () => {
      it('should retrieve session timeout as number', async () => {
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: '60',
          },
        });

        const result = await getSessionTimeoutMinutes();

        expect(result).toBe(60);
        expect(typeof result).toBe('number');
      });
    });

    describe('getFreeTierLimits', () => {
      it('should retrieve and parse free tier limits', async () => {
        const mockLimits: FreeTierLimits = {
          food_recognition: 25,
          glucose_prediction: 20,
          meal_recommendation: 15,
          voice_entry: 20,
          text_nutrient_analysis: 25,
          insulin_dose: 20,
          pattern_insight: 1,
        };

        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Value: JSON.stringify(mockLimits),
          },
        });

        const result = await getFreeTierLimits();

        expect(result).toEqual(mockLimits);
      });
    });

    describe('getAllConfigParameters', () => {
      it('should retrieve all parameters in batch', async () => {
        const mockParameters = [
          {
            Name: '/dev/ai-diet/bedrock-model-id',
            Value: 'anthropic.claude-3-sonnet-20240229-v1:0',
          },
          {
            Name: '/dev/ai-diet/bedrock-region',
            Value: 'us-east-1',
          },
          {
            Name: '/dev/ai-diet/ses-from-email',
            Value: 'noreply@aidiet.app',
          },
          {
            Name: '/dev/ai-diet/api-rate-limit',
            Value: '100',
          },
          {
            Name: '/dev/ai-diet/session-timeout-minutes',
            Value: '60',
          },
          {
            Name: '/dev/ai-diet/free-tier-limits',
            Value: JSON.stringify({
              food_recognition: 25,
              glucose_prediction: 20,
              meal_recommendation: 15,
              voice_entry: 20,
              text_nutrient_analysis: 25,
              insulin_dose: 20,
              pattern_insight: 1,
            }),
          },
        ];

        ssmMock.on(GetParametersByPathCommand).resolves({
          Parameters: mockParameters,
        });

        const result = await getAllConfigParameters();

        expect(result.bedrockModelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
        expect(result.bedrockRegion).toBe('us-east-1');
        expect(result.sesFromEmail).toBe('noreply@aidiet.app');
        expect(result.apiRateLimit).toBe(100);
        expect(result.sessionTimeoutMinutes).toBe(60);
        expect(result.freeTierLimits.food_recognition).toBe(25);
      });

      it('should throw error if no parameters found', async () => {
        ssmMock.on(GetParametersByPathCommand).resolves({
          Parameters: [],
        });

        await expect(getAllConfigParameters()).rejects.toThrow(
          'No configuration parameters found'
        );
      });
    });
  });

  describe('Cache Management', () => {
    it('should cache secrets for 5 minutes', async () => {
      const mockSecret = 'test-secret';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: mockSecret,
      });

      // First call
      await getJwtSecret();
      
      // Second call within cache TTL
      await getJwtSecret();

      // Should only make one API call
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it('should clear cache when clearSecretsCache is called', async () => {
      const mockSecret = 'test-secret';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: mockSecret,
      });

      // First call
      await getJwtSecret();
      
      // Clear cache
      clearSecretsCache();
      
      // Second call after cache clear
      await getJwtSecret();

      // Should make two API calls
      expect(secretsManagerMock.calls()).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    describe('getSecretWithRetry', () => {
      it('should retry on failure and succeed', async () => {
        let callCount = 0;
        const mockFetcher = jest.fn(async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        });

        const result = await getSecretWithRetry(mockFetcher, 3);

        expect(result).toBe('success');
        expect(mockFetcher).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max retries', async () => {
        const mockFetcher = jest.fn(async () => {
          throw new Error('Persistent failure');
        });

        await expect(getSecretWithRetry(mockFetcher, 3)).rejects.toThrow(
          'Failed to retrieve secret after 3 attempts'
        );

        expect(mockFetcher).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle AWS SDK errors gracefully', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects(
        new Error('ResourceNotFoundException: Secret not found')
      );

      await expect(getJwtSecret()).rejects.toThrow('Secret not found');
    });
  });

  describe('Environment-Specific Paths', () => {
    it('should use correct path for dev environment', async () => {
      process.env.ENVIRONMENT = 'dev';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test-secret',
      });

      await getJwtSecret();

      const calls = secretsManagerMock.calls();
      expect(calls[0].args[0].input).toMatchObject({
        SecretId: '/dev/ai-diet/jwt-secret',
      });
    });

    it('should use correct path for prod environment', async () => {
      process.env.ENVIRONMENT = 'prod';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test-secret',
      });

      await getJwtSecret();

      const calls = secretsManagerMock.calls();
      expect(calls[0].args[0].input).toMatchObject({
        SecretId: '/prod/ai-diet/jwt-secret',
      });
    });
  });
});
