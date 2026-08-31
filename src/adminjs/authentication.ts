import bcrypt from 'bcrypt'
import { User } from '../models/User'

export const authenticationOptions = {
  authenticate: async (email: string, password: string) => {
    const user = await User.findOne({ where: { email } })

    if (!user || user.role !== 'admin') {
      return null
    }

    const matched = await bcrypt.compare(password, user.passwordHash)
    if (!matched) {
      return null
    }

    return { id: user.id, email: user.email, role: user.role }
  },
  cookieName: 'workflow-admin',
  cookiePassword: process.env.COOKIE_SECRET || 'dev-workflow-cookie-secret-change-me',
}
