/**
 * Unit Tests for AuthStack
 * 
 * Tests Cognito User Pool configuration for:
 * - Email/password authentication
 * - Password policy (12+ chars, complexity)
 * - Custom attributes (subscription_tier, diabetes_type)
 * - Email verification
 * - Session timeout (60 minutes)
 * - MFA configuration
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';
import { devConfig } from '../config/environments/dev';
import { prodConfig } from '../config/environments/prod';

describe('AuthStack', () => {
  describe('Cognito User Pool Configuration', () => {
    let app: cdk.App;
    let stack: AuthStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });
      template = Template.fromStack(stack);
    });

    test('should create Cognito User Pool', () => {
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    test('should enable email as sign-in alias', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
      });
    });

    test('should enable email auto-verification', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: ['email'],
      });
    });

    test('should enable self-registration', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      });
    });

    test('should configure password policy with 12+ character minimum', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 12,
            RequireLowercase: true,
            RequireUppercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
          },
        },
      });
    });

    test('should configure email-only account recovery', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: [
            {
              Name: 'verified_email',
              Priority: 1,
            },
          ],
        },
      });
    });

    test('should configure custom attributes for subscription_tier and diabetes_type', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          // Standard email attribute
          Match.objectLike({
            Name: 'email',
            Required: true,
            Mutable: true,
          }),
          // Custom subscription_tier attribute
          Match.objectLike({
            Name: 'subscription_tier',
            Mutable: true,
            AttributeDataType: 'String',
          }),
          // Custom diabetes_type attribute
          Match.objectLike({
            Name: 'diabetes_type',
            Mutable: true,
            AttributeDataType: 'String',
          }),
        ]),
      });
    });

    test('should configure MFA as OFF for dev environment', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        MfaConfiguration: 'OFF',
      });
    });

    test('should configure MFA second factors (SMS and OTP) when MFA is enabled', () => {
      // For dev environment with MFA OFF, EnabledMfas is not set
      // This test verifies the configuration is present in the code
      // In production with MFA enabled, these would be active
      const prodApp = new cdk.App();
      const prodStack = new AuthStack(prodApp, 'ProdAuthStack', {
        environmentConfig: prodConfig,
      });
      const prodTemplate = Template.fromStack(prodStack);
      
      prodTemplate.hasResourceProperties('AWS::Cognito::UserPool', {
        EnabledMfas: Match.arrayWith([
          Match.stringLikeRegexp('SMS_MFA'),
          Match.stringLikeRegexp('SOFTWARE_TOKEN_MFA'),
        ]),
      });
    });
  });

  describe('Cognito User Pool Client Configuration', () => {
    let app: cdk.App;
    let stack: AuthStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });
      template = Template.fromStack(stack);
    });

    test('should create Cognito User Pool Client', () => {
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    test('should enable USER_PASSWORD_AUTH flow', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith([
          'ALLOW_USER_PASSWORD_AUTH',
          'ALLOW_USER_SRP_AUTH',
          'ALLOW_REFRESH_TOKEN_AUTH',
        ]),
      });
    });

    test('should not generate client secret (for mobile apps)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        GenerateSecret: false,
      });
    });

    test('should configure 60-minute token validity (Requirement 13.5)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
        TokenValidityUnits: {
          AccessToken: 'minutes',
          IdToken: 'minutes',
        },
      });
    });

    test('should configure 30-day refresh token validity', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        RefreshTokenValidity: 43200, // 30 days in minutes (30 * 24 * 60)
        TokenValidityUnits: {
          RefreshToken: 'minutes',
        },
      });
    });
  });

  describe('Production Environment Configuration', () => {
    let app: cdk.App;
    let stack: AuthStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new AuthStack(app, 'ProdAuthStack', {
        environmentConfig: prodConfig,
      });
      template = Template.fromStack(stack);
    });

    test('should enable MFA as OPTIONAL for production', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        MfaConfiguration: 'OPTIONAL',
      });
    });

    test('should use RETAIN removal policy for production', () => {
      template.hasResource('AWS::Cognito::UserPool', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    test('should configure production resource naming', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'prod-ai-diet-users',
      });
    });
  });

  describe('Stack Outputs', () => {
    let app: cdk.App;
    let stack: AuthStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });
      template = Template.fromStack(stack);
    });

    test('should export User Pool ID', () => {
      template.hasOutput('UserPoolId', {
        Description: 'Cognito User Pool ID',
        Export: {
          Name: 'dev-AiDietUserPoolId',
        },
      });
    });

    test('should export User Pool Client ID', () => {
      template.hasOutput('UserPoolClientId', {
        Description: 'Cognito User Pool Client ID',
        Export: {
          Name: 'dev-AiDietUserPoolClientId',
        },
      });
    });

    test('should export User Pool ARN', () => {
      template.hasOutput('UserPoolArn', {
        Description: 'Cognito User Pool ARN',
        Export: {
          Name: 'dev-AiDietUserPoolArn',
        },
      });
    });
  });

  describe('HIPAA Compliance Requirements', () => {
    let app: cdk.App;
    let stack: AuthStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });
      template = Template.fromStack(stack);
    });

    test('should enforce strong password policy (Requirement 13)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: Match.exact(12),
            RequireLowercase: true,
            RequireUppercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
          },
        },
      });
    });

    test('should enforce 60-minute session timeout (Requirement 13.5)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AccessTokenValidity: 60,
        IdTokenValidity: 60,
      });
    });

    test('should require email verification (Requirement 13)', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: Match.arrayWith(['email']),
      });
    });
  });

  describe('User Pool Properties Accessibility', () => {
    test('should expose userPool property', () => {
      const app = new cdk.App();
      const stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });

      expect(stack.userPool).toBeDefined();
      expect(stack.userPool.userPoolId).toBeDefined();
      expect(stack.userPool.userPoolArn).toBeDefined();
    });

    test('should expose userPoolClient property', () => {
      const app = new cdk.App();
      const stack = new AuthStack(app, 'TestAuthStack', {
        environmentConfig: devConfig,
      });

      expect(stack.userPoolClient).toBeDefined();
      expect(stack.userPoolClient.userPoolClientId).toBeDefined();
    });
  });
});
