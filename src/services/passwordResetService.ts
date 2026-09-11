// src/services/passwordResetService.ts
//
// Reset de senha pela agência: gera uma senha temporária previsível (nome + "workflow" + ano)
// e devolve em texto puro pra agência repassar por fora (WhatsApp etc.) — não há infra de
// envio de e-mail no projeto. Usado pelos controllers de freelancer/supermercado/líder/sócio,
// cada um resolvendo antes se o chamador tem permissão de agir sobre aquele perfil.

import bcrypt from 'bcrypt'
import { User } from '../models/User'
import { buildPatternPassword } from '../helpers/loginCredentials'

export const passwordResetService = {
  async resetForUser(userId: string): Promise<{ email: string; password: string }> {
    const user = await User.findByPk(userId)
    if (!user) throw new Error('Usuário não encontrado.')

    const password = buildPatternPassword(user.name)
    const passwordHash = await bcrypt.hash(password, 10)
    await user.update({ passwordHash })

    return { email: user.email, password }
  },
}
