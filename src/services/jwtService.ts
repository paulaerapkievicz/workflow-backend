import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'dev-workflow-jwt-secret-change-me'

export interface AuthTokenPayload extends JwtPayload {
  sub: string
  role: 'admin' | 'supermarket' | 'freelancer' | 'agency'
  email: string
}

export const jwtService = {
  sign(payload: { sub: string; role: AuthTokenPayload['role']; email: string }, expiresIn: SignOptions['expiresIn'] = '7d') {
    return jwt.sign(payload, secret, { expiresIn })
  },

  verify(token: string): Promise<AuthTokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err || !decoded || typeof decoded === 'string') {
          return reject(err || new Error('Token inválido'))
        }
        resolve(decoded as AuthTokenPayload)
      })
    })
  },
}
