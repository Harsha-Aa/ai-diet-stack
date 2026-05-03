import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient } from '../config/aws';
import { config } from '../config';
import * as userRepository from '../repositories/user.repository';

export interface RegisterInput {
  email: string;
  password: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  diabetes_type: 'type1' | 'type2' | 'prediabetes' | 'gestational';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

/**
 * Register a new user with Cognito and create profile in DynamoDB
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  try {
    // Step 1: Register user in Cognito
    const signUpCommand = new SignUpCommand({
      ClientId: config.aws.cognito.clientId,
      Username: input.email,
      Password: input.password,
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'custom:diabetes_type', Value: input.diabetes_type },
        { Name: 'custom:subscription_tier', Value: 'free' },
      ],
    });

    const signUpResponse = await cognitoClient.send(signUpCommand);
    const userId = signUpResponse.UserSub!;

    // Step 2: Calculate BMI
    const bmi = input.weight_kg / Math.pow(input.height_cm / 100, 2);

    // Step 3: Create user profile in DynamoDB
    await userRepository.createUser({
      userId,
      email: input.email,
      diabetesType: input.diabetes_type,
      age: input.age,
      weight: input.weight_kg,
      height: input.height_cm,
      bmi: Number(bmi.toFixed(1)),
      tier: 'free',
      targetGlucoseMin: 70,
      targetGlucoseMax: 180,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Step 4: Auto-login after registration
    const loginResponse = await login({
      email: input.email,
      password: input.password,
    });

    return loginResponse;
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.name === 'UsernameExistsException') {
      throw new Error('User already exists');
    }
    if (error.name === 'InvalidPasswordException') {
      throw new Error('Password does not meet requirements (min 8 chars, uppercase, lowercase, number)');
    }
    
    throw new Error(`Registration failed: ${error.message}`);
  }
}

/**
 * Login user with Cognito
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  try {
    const authCommand = new InitiateAuthCommand({
      ClientId: config.aws.cognito.clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: input.email,
        PASSWORD: input.password,
      },
    });

    const authResponse = await cognitoClient.send(authCommand);

    if (!authResponse.AuthenticationResult) {
      throw new Error('Authentication failed');
    }

    const { AccessToken, RefreshToken, IdToken, ExpiresIn } = authResponse.AuthenticationResult;

    // Get user details from Cognito
    const getUserCommand = new GetUserCommand({
      AccessToken: AccessToken!,
    });

    const userResponse = await cognitoClient.send(getUserCommand);
    const userId = userResponse.Username!;

    return {
      userId,
      email: input.email,
      accessToken: AccessToken!,
      refreshToken: RefreshToken!,
      idToken: IdToken!,
      expiresIn: ExpiresIn || 3600,
    };
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.name === 'NotAuthorizedException') {
      throw new Error('Invalid email or password');
    }
    if (error.name === 'UserNotFoundException') {
      throw new Error('User not found');
    }
    
    throw new Error(`Login failed: ${error.message}`);
  }
}

/**
 * Get user profile from DynamoDB
 */
export async function getProfile(userId: string) {
  try {
    const profile = await userRepository.getUserById(userId);
    
    if (!profile) {
      throw new Error('Profile not found');
    }

    return profile;
  } catch (error: any) {
    console.error('Get profile error:', error);
    throw new Error(`Failed to get profile: ${error.message}`);
  }
}

/**
 * Update user profile in DynamoDB
 */
export async function updateProfile(userId: string, updates: Partial<RegisterInput>) {
  try {
    // Recalculate BMI if weight or height changed
    let bmi: number | undefined;
    if (updates.weight_kg && updates.height_cm) {
      bmi = updates.weight_kg / Math.pow(updates.height_cm / 100, 2);
    }

    const profileUpdates: any = {
      ...updates,
      ...(bmi && { bmi: Number(bmi.toFixed(1)) }),
      updatedAt: new Date().toISOString(),
    };

    await userRepository.updateUser(userId, profileUpdates);

    return await userRepository.getUserById(userId);
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
}
