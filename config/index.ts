/**
 * Environment Configuration Loader
 * 
 * Exports utility functions to load environment-specific configurations
 */

import { EnvironmentConfig, EnvironmentName } from './environment';
import { devConfig } from './environments/dev';
import { stagingConfig } from './environments/staging';
import { prodConfig } from './environments/prod';

/**
 * Get environment configuration based on environment name
 * 
 * @param environmentName - The environment name (dev, staging, prod)
 * @returns Environment-specific configuration
 * @throws Error if environment name is invalid
 */
export function getEnvironmentConfig(environmentName: string): EnvironmentConfig {
  const env = environmentName.toLowerCase() as EnvironmentName;
  
  switch (env) {
    case 'dev':
      return devConfig;
    case 'staging':
      return stagingConfig;
    case 'prod':
      return prodConfig;
    default:
      throw new Error(
        `Invalid environment: ${environmentName}. Must be one of: dev, staging, prod`
      );
  }
}

/**
 * Get current environment name from CDK context or environment variable
 * Defaults to 'dev' if not specified
 * 
 * @param app - CDK App instance
 * @returns Environment name
 */
export function getCurrentEnvironment(app: any): EnvironmentName {
  // Try to get from CDK context first (--context stage=prod)
  const contextEnv = app.node.tryGetContext('stage');
  
  // Fall back to environment variable
  const envVar = process.env.STAGE || process.env.ENVIRONMENT;
  
  // Default to dev
  const env = (contextEnv || envVar || 'dev').toLowerCase();
  
  // Validate environment name
  if (!['dev', 'staging', 'prod'].includes(env)) {
    console.warn(`Invalid environment '${env}', defaulting to 'dev'`);
    return 'dev';
  }
  
  return env as EnvironmentName;
}

/**
 * Generate resource name with environment prefix/suffix
 * 
 * @param config - Environment configuration
 * @param baseName - Base resource name
 * @param usePrefix - Whether to use prefix (default: true)
 * @param useSuffix - Whether to use suffix (default: false)
 * @returns Formatted resource name
 */
export function getResourceName(
  config: EnvironmentConfig,
  baseName: string,
  usePrefix: boolean = true,
  useSuffix: boolean = false
): string {
  const parts: string[] = [];
  
  if (usePrefix) {
    parts.push(config.resourcePrefix);
  }
  
  parts.push(baseName);
  
  if (useSuffix) {
    parts.push(config.resourceSuffix);
  }
  
  return parts.join('-');
}

/**
 * Get stack name with environment prefix
 * 
 * @param config - Environment configuration
 * @param stackName - Base stack name
 * @returns Formatted stack name
 */
export function getStackName(config: EnvironmentConfig, stackName: string): string {
  return `${config.resourcePrefix}-${stackName}`;
}

// Export environment configs for direct access if needed
export { devConfig, stagingConfig, prodConfig };
export type { EnvironmentConfig, EnvironmentName };
