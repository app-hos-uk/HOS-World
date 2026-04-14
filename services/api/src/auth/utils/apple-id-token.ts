import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86_400_000,
  rateLimit: true,
});

function getAppleSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('Apple id_token missing kid'));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify Apple identity token (JWT) using Apple's JWKS.
 */
export function verifyAppleIdToken(idToken: string, audience: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getAppleSigningKey,
      {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
          return;
        }
        if (!decoded || typeof decoded === 'string') {
          reject(new Error('Invalid Apple id_token payload'));
          return;
        }
        if (!decoded.sub || typeof decoded.sub !== 'string') {
          reject(new Error('Apple id_token missing required sub claim'));
          return;
        }
        resolve(decoded as jwt.JwtPayload);
      },
    );
  });
}
