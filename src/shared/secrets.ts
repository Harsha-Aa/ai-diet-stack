/**
 * Secrets Management Utilities
 * 
 * Provides functions to retrieve secrets from AWS Secrets Manager
 * and parameters from AWS Systems Manager Parameter Store.
 * 
 * Features:
 * - Automatic caching to reduce API calls
 * - Type-safe secret retrieval
 * - Error handling with retries
 * - Environment-aware secret paths
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandInput,
} from '@aws-sdk/client-secrets-manager';
import {
  SSMClient,
  GetParameterCommand,
  GetParametersCommand,
  GetParametersByPathCommand,
} from '@aws-sdk/client-ssm';
import { getCurrentEnvironment } from './environment';

// Initialize AWS clients
const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// In-memory cache for secrets and parameters
const secretsCache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the secret path prefix for the current environment
 */
function getSecretPrefix(): string {
  const env = getCurrentEnvironment();
  return `/${env}/ai-diet`;
}

/**
 * Check if a cached value is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

/**
 * Get a secret from cache or fetch from Secrets Manager
 */
async function getCachedSecret(key: string, fetcher: () => Promise<any>): Promise<any> {
  const cached = secretsCache.get(key);
  
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.value;
  }
  
  const value = await fetcher();
  secretsCache.set(key, { value, timestamp: Date.now() });
  
  return value;
}

/**
 * Clear the secrets cache (useful for testing or forced refresh)
 */
export function clearSecretsCache(): void {
  secretsCache.clear();
}

// ============================================================
// SECRETS MANAGER - Sensitive Data
// ============================================================

/**
 * Database credentials interface
 */
export interface DatabaseCredentials {
  username: string;
  password: string;
  engine: string;
  host?: string;
  port?: number;
  dbname?: string;
}

/**
 * Get database credentials from Secrets Manager
 */
export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const secretName = `${getSecretPrefix()}/database-credentials`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Database credentials secret is empty');
    }
    
    return JSON.parse(response.SecretString) as DatabaseCredentials;
  });
}

/**
 * Get JWT signing secret from Secrets Manager
 */
export async function getJwtSecret(): Promise<string> {
  const secretName = `${getSecretPrefix()}/jwt-secret`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('JWT secret is empty');
    }
    
    return response.SecretString;
  });
}

/**
 * Get application encryption key from Secrets Manager
 */
export async function getEncryptionKey(): Promise<string> {
  const secretName = `${getSecretPrefix()}/encryption-key`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Encryption key is empty');
    }
    
    return response.SecretString;
  });
}

/**
 * Get Stripe API key from Secrets Manager
 */
export async function getStripeApiKey(): Promise<string> {
  const secretName = `${getSecretPrefix()}/stripe-api-key`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Stripe API key is empty');
    }
    
    return response.SecretString;
  });
}

/**
 * CGM API credentials interface
 */
export interface CgmApiCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Get Dexcom CGM API credentials from Secrets Manager
 */
export async function getDexcomApiCredentials(): Promise<CgmApiCredentials> {
  const secretName = `${getSecretPrefix()}/dexcom-api-credentials`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Dexcom API credentials are empty');
    }
    
    return JSON.parse(response.SecretString) as CgmApiCredentials;
  });
}

/**
 * Get Libre CGM API credentials from Secrets Manager
 */
export async function getLibreApiCredentials(): Promise<CgmApiCredentials> {
  const secretName = `${getSecretPrefix()}/libre-api-credentials`;
  
  return getCachedSecret(secretName, async () => {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsManagerClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Libre API credentials are empty');
    }
    
    return JSON.parse(response.SecretString) as CgmApiCredentials;
  });
}

// ============================================================
// PARAMETER STORE - Non-Sensitive Configuration
// ============================================================

/**
 * Get Bedrock model ID from Parameter Store
 */
export async function getBedrockModelId(): Promise<string> {
  const parameterName = `${getSecretPrefix()}/bedrock-model-id`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('Bedrock model ID parameter is empty');
    }
    
    return response.Parameter.Value;
  });
}

/**
 * Get Bedrock region from Parameter Store
 */
export async function getBedrockRegion(): Promise<string> {
  const parameterName = `${getSecretPrefix()}/bedrock-region`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('Bedrock region parameter is empty');
    }
    
    return response.Parameter.Value;
  });
}

/**
 * Get SES from email from Parameter Store
 */
export async function getSesFromEmail(): Promise<string> {
  const parameterName = `${getSecretPrefix()}/ses-from-email`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('SES from email parameter is empty');
    }
    
    return response.Parameter.Value;
  });
}

/**
 * Get API rate limit from Parameter Store
 */
export async function getApiRateLimit(): Promise<number> {
  const parameterName = `${getSecretPrefix()}/api-rate-limit`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('API rate limit parameter is empty');
    }
    
    return parseInt(response.Parameter.Value, 10);
  });
}

/**
 * Get session timeout in minutes from Parameter Store
 */
export async function getSessionTimeoutMinutes(): Promise<number> {
  const parameterName = `${getSecretPrefix()}/session-timeout-minutes`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('Session timeout parameter is empty');
    }
    
    return parseInt(response.Parameter.Value, 10);
  });
}

/**
 * Free tier limits interface
 */
export interface FreeTierLimits {
  food_recognition: number;
  glucose_prediction: number;
  meal_recommendation: number;
  voice_entry: number;
  text_nutrient_analysis: number;
  insulin_dose: number;
  pattern_insight: number;
}

/**
 * Get free tier usage limits from Parameter Store
 */
export async function getFreeTierLimits(): Promise<FreeTierLimits> {
  const parameterName = `${getSecretPrefix()}/free-tier-limits`;
  
  return getCachedSecret(parameterName, async () => {
    const command = new GetParameterCommand({ Name: parameterName });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error('Free tier limits parameter is empty');
    }
    
    return JSON.parse(response.Parameter.Value) as FreeTierLimits;
  });
}

/**
 * Get all configuration parameters at once (batch operation)
 */
export async function getAllConfigParameters(): Promise<{
  bedrockModelId: string;
  bedrockRegion: string;
  sesFromEmail: string;
  apiRateLimit: number;
  sessionTimeoutMinutes: number;
  freeTierLimits: FreeTierLimits;
}> {
  const prefix = getSecretPrefix();
  
  const command = new GetParametersByPathCommand({
    Path: prefix,
    Recursive: true,
  });
  
  const response = await ssmClient.send(command);
  
  if (!response.Parameters || response.Parameters.length === 0) {
    throw new Error('No configuration parameters found');
  }
  
  const params: Record<string, string> = {};
  for (const param of response.Parameters) {
    if (param.Name && param.Value) {
      const key = param.Name.replace(`${prefix}/`, '');
      params[key] = param.Value;
    }
  }
  
  return {
    bedrockModelId: params['bedrock-model-id'],
    bedrockRegion: params['bedrock-region'],
    sesFromEmail: params['ses-from-email'],
    apiRateLimit: parseInt(params['api-rate-limit'], 10),
    sessionTimeoutMinutes: parseInt(params['session-timeout-minutes'], 10),
    freeTierLimits: JSON.parse(params['free-tier-limits']),
  };
}

/**
 * Error handling wrapper for secret retrieval
 * Retries up to 3 times with exponential backoff
 */
export async function getSecretWithRetry<T>(
  fetcher: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(
    `Failed to retrieve secret after ${maxRetries} attempts: ${lastError?.message}`
  );
}
