import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import config from '../config';

// Create JWT verifier for access tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: config.aws.cognito.userPoolId,
  tokenUse: 'access',
  clientId: config.aws.cognito.clientId,
});

// Extend Express Request type to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        sub: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * Middleware to verify JWT token from Cognito
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token with Cognito
    try {
      const payload = await verifier.verify(token);

      // Attach user info to request object
      req.user = {
        userId: payload.sub, // Cognito user ID (sub claim)
        email: String(payload.email || ''),
        sub: payload.sub,
      };

      next();
    } catch (verifyError: any) {
      console.error('Token verification failed:', verifyError.message);

      // Handle specific verification errors
      if (verifyError.name === 'JwtExpiredError') {
        res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Access token has expired',
          },
        });
        return;
      }

      if (verifyError.name === 'JwtInvalidSignatureError') {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid token signature',
          },
        });
        return;
      }

      // Generic token verification failure
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token verification failed',
        },
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication error',
      },
    });
    return;
  }
}

/**
 * Optional middleware - allows requests without authentication
 * but attaches user info if token is present
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user info
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verifier.verify(token);

      req.user = {
        userId: payload.sub,
        email: String(payload.email || ''),
        sub: payload.sub,
      };
    } catch (verifyError) {
      // Token verification failed, but continue without user info
      console.warn('Optional auth: Token verification failed');
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
}

/**
 * Middleware to check if user has premium tier
 */
export function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Check if user has premium tier (stored in custom attribute)
  const tier = req.user['custom:tier'] || 'free';

  if (tier !== 'premium') {
    res.status(403).json({
      success: false,
      error: {
        code: 'PREMIUM_REQUIRED',
        message: 'This feature requires a premium subscription',
      },
    });
    return;
  }

  next();
}
