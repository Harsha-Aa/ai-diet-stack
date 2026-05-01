/**
 * Validation schemas for authentication endpoints
 */

import { z } from 'zod';
import { DiabetesType } from '../shared/types';
import { GLUCOSE_LIMITS } from '../shared/constants';

/**
 * Registration request validation schema
 * Validates user input for POST /auth/register
 */
export const registrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  diabetesType: z.nativeEnum(DiabetesType, {
    errorMap: () => ({ message: 'Invalid diabetes type. Must be PRE_DIABETES, TYPE_1, or TYPE_2' }),
  }),
  age: z.number().int().min(1, 'Age must be at least 1').max(120, 'Age must be at most 120'),
  weight: z.number().positive('Weight must be positive').max(500, 'Weight must be at most 500 kg'),
  height: z
    .number()
    .positive('Height must be positive')
    .min(50, 'Height must be at least 50 cm')
    .max(300, 'Height must be at most 300 cm'),
  targetGlucoseMin: z
    .number()
    .min(GLUCOSE_LIMITS.MIN, `Target glucose min must be at least ${GLUCOSE_LIMITS.MIN} mg/dL`)
    .max(GLUCOSE_LIMITS.MAX, `Target glucose min must be at most ${GLUCOSE_LIMITS.MAX} mg/dL`),
  targetGlucoseMax: z
    .number()
    .min(GLUCOSE_LIMITS.MIN, `Target glucose max must be at least ${GLUCOSE_LIMITS.MIN} mg/dL`)
    .max(GLUCOSE_LIMITS.MAX, `Target glucose max must be at most ${GLUCOSE_LIMITS.MAX} mg/dL`),
}).refine((data) => data.targetGlucoseMax > data.targetGlucoseMin, {
  message: 'Target glucose max must be greater than target glucose min',
  path: ['targetGlucoseMax'],
});

/**
 * Update profile request validation schema
 * Validates user input for PUT /auth/profile
 */
export const updateProfileSchema = z.object({
  age: z.number().int().min(1).max(120).optional(),
  weight: z.number().positive().max(500).optional(),
  height: z.number().positive().min(50).max(300).optional(),
  targetGlucoseMin: z
    .number()
    .min(GLUCOSE_LIMITS.MIN)
    .max(GLUCOSE_LIMITS.MAX)
    .optional(),
  targetGlucoseMax: z
    .number()
    .min(GLUCOSE_LIMITS.MIN)
    .max(GLUCOSE_LIMITS.MAX)
    .optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
      highGlucoseThreshold: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX).optional(),
      lowGlucoseThreshold: z.number().min(GLUCOSE_LIMITS.MIN).max(GLUCOSE_LIMITS.MAX).optional(),
    })
    .optional(),
  insulinToCarbRatio: z.number().positive().optional(),
  correctionFactor: z.number().positive().optional(),
}).refine(
  (data) => {
    if (data.targetGlucoseMin && data.targetGlucoseMax) {
      return data.targetGlucoseMax > data.targetGlucoseMin;
    }
    return true;
  },
  {
    message: 'Target glucose max must be greater than target glucose min',
    path: ['targetGlucoseMax'],
  }
);

/**
 * Login request validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
