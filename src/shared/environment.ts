/**
 * Environment Detection Utilities
 * 
 * Helper functions for detecting and working with environment configurations
 * in Lambda functions and application code.
 */

export type EnvironmentName = 'dev' | 'staging' | 'prod';

/**
 * Get the current environment from environment variables
 * 
 * @returns Current environment name
 */
export function getCurrentEnvironment(): EnvironmentName {
  const env = (process.env.ENVIRONMENT || process.env.STAGE || 'dev').toLowerCase();
  
  if (!['dev', 'staging', 'prod'].includes(env)) {
    console.warn(`Invalid environment '${env}', defaulting to 'dev'`);
    return 'dev';
  }
  
  return env as EnvironmentName;
}

/**
 * Check if running in production environment
 * 
 * @returns True if in production
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'prod';
}

/**
 * Check if running in development environment
 * 
 * @returns True if in development
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'dev';
}

/**
 * Check if running in staging environment
 * 
 * @returns True if in staging
 */
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * Get environment-specific resource name
 * 
 * @param baseName - Base resource name
 * @returns Resource name with environment prefix
 */
export function getResourceName(baseName: string): string {
  const env = getCurrentEnvironment();
  return `${env}-${baseName}`;
}

/**
 * Get environment-specific configuration value
 * 
 * @param key - Configuration key
 * @param defaultValue - Default value if not found
 * @returns Configuration value
 */
export function getEnvConfig<T>(key: string, defaultValue: T): T {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  // Try to parse as JSON for complex types
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

/**
 * Environment-specific logging
 * Logs detailed information in dev/staging, minimal in production
 * 
 * @param message - Log message
 * @param data - Additional data to log
 */
export function envLog(message: string, data?: any): void {
  const env = getCurrentEnvironment();
  
  if (env === 'prod') {
    // Minimal logging in production
    console.log(message);
  } else {
    // Detailed logging in dev/staging
    console.log(message, data ? JSON.stringify(data, null, 2) : '');
  }
}

/**
 * Get table name with environment prefix
 * 
 * @param tableName - Base table name
 * @returns Full table name with environment prefix
 */
export function getTableName(tableName: string): string {
  return getResourceName(tableName);
}

/**
 * Get S3 bucket name with environment prefix
 * 
 * @param bucketName - Base bucket name
 * @returns Full bucket name with environment prefix
 */
export function getBucketName(bucketName: string): string {
  return getResourceName(bucketName);
}
