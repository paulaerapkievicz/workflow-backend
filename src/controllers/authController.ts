import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { sequelize } from '../database'
import { User } from '../models/User'
import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { Commission } from '../models/Commission'
import { SupermarketMember } from '../models/SupermarketMember'
import { AgencyMember } from '../models/AgencyMember'
import { AgencyPartner } from '../models/AgencyPartner'
import { defaultPartnerPermissions, sanitizePartnerPermissions } from '../helpers/agencyPartnerPermissions'
import { FreelancerContract } from '../models/FreelancerContract'
import { UniformOrder } from '../models/UniformOrder'
import { ContractTemplate } from '../models/ContractTemplate'
import { FreelancerContractSignature } from '../models/FreelancerContractSignature'
import { jwtService } from '../services/jwtService'
import { profileService } from '../services/profileService'
import { inviteService } from '../services/inviteService'
import { teamRoleService } from '../services/teamRoleService'
import { AuthRequest, Role } from '../middlewares/auth'
import { assertField } from '../helpers/validation'
import { resolveLoginEmail, emailAlreadyRegistered } from '../helpers/loginCredentials'

/** Serializa o perfil e anexa contexto extra por papel (permissões do supermercado, onboarding do colaborador). */
async function profileWithContext(user: { id: string; role: Role }) {
  const profile = await profileService.forUser(user)
  if (!profile) return null

  if (user.role === 'supermarket') {
    const membership = await profileService.supermarketContextForUser(user)
    return { ...(profile as any).toJSON(), membership }
  }

  if (user.role === 'leader') {
    const m = profile as any
    return {
      id: m.id,
      role: 'leader',
      agencyId: m.agencyId,
      agencyName: m.memberAgency?.name ?? null,
      active: m.active,
      payType: m.payType ?? null,
      payAmount: m.payAmount != null ? Number(m.payAmount) : null,
      availableBalance: Number(m.availableBalance ?? 0),
    }
  }

  if (user.role === 'partner') {
    const p = profile as any
    return {
      id: p.id,
      role: 'partner',
      agencyId: p.agencyId,
      agencyName: p.partnerAgency?.name ?? null,
      active: p.active,
      teamRoleId: p.teamRoleId ?? null,
      permissions: sanitizePartnerPermissions(p.permissions),
    }
  }

  if (user.role === 'freelancer') {
    const f = profile as any
    const agency = f.agencyId ? await Agency.findByPk(f.agencyId) : null
    const contract = await FreelancerContract.findOne({ where: { freelancerId: f.id } })
    const uniform = await UniformOrder.findOne({
      where: { freelancerId: f.id },
      order: [['createdAt', 'DESC']],
    })
    const required = !!agency?.onboardingRequired
    const contractComplete = !!contract?.completedAt
    const approved = !!f.onboardingApprovedAt
    // Autocadastro aguardando a agência aprovar: bloqueia tudo até lá.
    const awaitingRegistration = f.registrationStatus === 'pending'
    const contractTemplate = f.agencyId
      ? await ContractTemplate.findOne({ where: { agencyId: f.agencyId, active: true }, attributes: ['id'] })
      : null
    const contractSigned = await FreelancerContractSignature.count({
      where: { freelancerId: f.id, status: 'signed' },
    })
    return {
      ...f.toJSON(),
      onboarding: {
        required,
        contractComplete,
        uniformStatus: uniform?.status ?? null,
        approved,
        registrationStatus: f.registrationStatus ?? 'approved',
        awaitingRegistration,
        blocked: awaitingRegistration || (required && (!contractComplete || !approved)),
        contractTemplateAvailable: !!contractTemplate,
        contractSigned: contractSigned > 0,
      },
    }
  }

  return profile
}

const VALID_ROLES: Role[] = ['admin', 'supermarket', 'freelancer', 'agency']

function publicUser(user: User) {
  const json = (user as any).toJSON ? (user as any).toJSON() : user
  delete json.passwordHash
  return json
}

export const authController = {
  // POST /auth/register
  async register(req: Request, res: Response) {
    const { name, password, inviteToken } = req.body ?? {}
    let { role } = req.body ?? {}
    const profile = req.body?.profile ?? {}
    const rawEmail = req.body?.email
    const rawPhone = req.body?.phone

    // Um convite manda no papel do cadastro — ignora o que veio do cliente, pra um
    // `role` adulterado não furar a intenção do convite gerado pela agência.
    let invite: import('../models/Invite').InviteInstance | null = null
    if (inviteToken) {
      try {
        invite = await inviteService.findActiveByToken(inviteToken)
      } catch (err) {
        return res.status(400).json({ message: err instanceof Error ? err.message : 'Convite inválido.' })
      }
      role = invite.role
    }

    if (!name || !rawEmail || !password || !role) {
      return res.status(400).json({ message: 'Informe nome, e-mail, senha e perfil.' })
    }

    // Normaliza/valida os campos tipados; guarda no banco sem máscara.
    let email: string
    let phone: string
    try {
      email = assertField(rawEmail, 'O e-mail', 'email', { required: true })
      phone = assertField(rawPhone, 'O telefone', 'phone')
      if (role === 'agency' || role === 'supermarket') {
        profile.cnpj = assertField(profile.cnpj, 'O CNPJ', 'cnpj', { required: true })
      }
      if (role === 'freelancer' && profile.document) {
        profile.document = assertField(profile.document, 'O CPF', 'cpf')
      }
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Dados inválidos.' })
    }
    // 'leader'/'partner' só são aceitos quando vêm de um convite gerado pela agência.
    if (role === 'leader' && !invite) {
      return res.status(400).json({ message: 'Cadastro de líder requer um convite da agência.' })
    }
    if (role === 'partner' && !invite) {
      return res.status(400).json({ message: 'Cadastro de sócio requer um convite da agência.' })
    }
    if (role !== 'leader' && role !== 'partner' && (!VALID_ROLES.includes(role) || role === 'admin')) {
      return res.status(400).json({ message: 'Perfil inválido para cadastro.' })
    }
    // Supermercado não tem mais autocadastro aberto — precisa ser convidado por uma agência,
    // porque todo supermercado nasce vinculado a exatamente uma agência (Supermarket.agencyId).
    if (role === 'supermarket' && !invite) {
      return res.status(400).json({ message: 'Cadastro de supermercado requer um convite da agência.' })
    }

    if (await emailAlreadyRegistered(email)) {
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' })
    }

    if ((role === 'supermarket' || role === 'agency') && (!profile.companyName || !profile.cnpj || !profile.address)) {
      return res.status(400).json({ message: 'Informe nome da empresa, CNPJ e endereço.' })
    }

    try {
      const result = await sequelize.transaction(async (t) => {
        // Agência "dona" pra fins da política de e-mail de login (nomesobrenome@workflow.com
        // vs. e-mail informado) — null quando o cadastro é de uma agência nova, que não tem
        // agência mãe e por isso sempre usa o e-mail informado.
        let policyAgencyId: string | null = null
        if (role === 'supermarket' || role === 'leader' || role === 'partner') {
          policyAgencyId = invite!.agencyId
        } else if (role === 'freelancer') {
          policyAgencyId = invite ? invite.agencyId : profile.agencyId ?? null
        }

        const loginEmail = await resolveLoginEmail(policyAgencyId, email, name)
        const passwordHash = await bcrypt.hash(password, 10)
        const user = await User.create(
          { name, email: loginEmail, contactEmail: email, passwordHash, role, phone: phone || null },
          { transaction: t }
        )

        let createdProfile: any = null

        if (role === 'supermarket') {
          // `invite` está garantido pela checagem acima.
          createdProfile = await Supermarket.create(
            {
              ownerId: user.id,
              agencyId: invite!.agencyId,
              name: profile.companyName,
              legalName: profile.legalName ?? undefined,
              cnpj: profile.cnpj,
              address: profile.address,
              phone: phone || undefined,
            },
            { transaction: t }
          )
          await teamRoleService.seedDefaults('supermarket', createdProfile.id, t)
          await SupermarketMember.create(
            {
              supermarketId: createdProfile.id,
              userId: user.id,
              canSubmitOrders: true,
              canApproveOrders: true,
              canViewInvoices: true,
              canPayInvoices: true,
              teamRoleId: await teamRoleService.adminRoleId('supermarket', createdProfile.id, t),
              isOwner: true,
            },
            { transaction: t }
          )
        } else if (role === 'agency') {
          const pct = profile.commissionPercentage != null ? Number(profile.commissionPercentage) : 10
          createdProfile = await Agency.create(
            { ownerId: user.id, name: profile.companyName, cnpj: profile.cnpj, address: profile.address, phone: phone || undefined, commissionPercentage: pct },
            { transaction: t }
          )
          await teamRoleService.seedDefaults('agency', createdProfile.id, t)
          await Commission.create({ agencyId: createdProfile.id, percentage: pct }, { transaction: t })
        } else if (role === 'freelancer') {
          let agencyId: string
          if (invite) {
            // Convite direcionado: a agência já vetou esse colaborador ao gerar o link.
            agencyId = invite.agencyId
          } else {
            // Autocadastro aberto — só permitido se a agência escolhida abriu essa porta,
            // e fica pendente até a agência aprovar manualmente.
            agencyId = profile.agencyId ?? null
            if (!agencyId) {
              throw new Error('Selecione a agência para se cadastrar.')
            }
            const agency = await Agency.findByPk(agencyId, { transaction: t })
            if (!agency) throw new Error('Agência não encontrada.')
            if (!agency.allowSelfRegistration) {
              throw new Error('Esta agência não está aceitando novos cadastros. Peça um convite à agência.')
            }
          }
          createdProfile = await Freelancer.create(
            {
              userId: user.id,
              agencyId,
              name,
              email,
              phone: phone || undefined,
              document: profile.document ?? undefined,
              skills: profile.skills ?? undefined,
              registrationStatus: invite ? 'approved' : 'pending',
            },
            { transaction: t }
          )
        } else if (role === 'leader') {
          // `invite` está garantido pela checagem acima. O pagamento vem do convite;
          // o escopo é definido depois pelo dono na tela de Equipe.
          createdProfile = await AgencyMember.create(
            {
              agencyId: invite!.agencyId,
              userId: user.id,
              active: true,
              payType: invite!.payType ?? null,
              payAmount: invite!.payAmount != null ? Number(invite!.payAmount) : null,
            },
            { transaction: t }
          )
        } else if (role === 'partner') {
          // `invite` está garantido pela checagem acima. Nasce com acesso total — o dono
          // restringe funcionalidade por funcionalidade depois na tela de Equipe.
          createdProfile = await AgencyPartner.create(
            {
              agencyId: invite!.agencyId,
              userId: user.id,
              active: true,
              permissions: defaultPartnerPermissions(),
            },
            { transaction: t }
          )
        }

        if (invite) {
          await inviteService.markUsed(invite, t)
        }

        return { user, profile: createdProfile }
      })

      const token = jwtService.sign({ sub: result.user.id, role: result.user.role, email: result.user.email })
      return res.status(201).json({ token, user: publicUser(result.user), profile: result.profile })
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao cadastrar.' })
    }
  },

  // POST /auth/login
  async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ message: 'Informe e-mail e senha.' })
    }

    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' })
    }

    if (user.role === 'agency') {
      const agency = await Agency.findOne({ where: { ownerId: user.id } })
      if (agency && agency.active === false) {
        return res.status(403).json({ message: 'Esta agência está desativada. Fale com o suporte.' })
      }
    }

    const token = jwtService.sign({ sub: user.id, role: user.role, email: user.email })
    const profile = await profileWithContext(user)
    return res.json({ token, user: publicUser(user), profile })
  },

  // GET /auth/me
  async me(req: AuthRequest, res: Response) {
    const user = req.user!
    const profile = await profileWithContext(user)
    return res.json({ user: publicUser(user), profile })
  },
}
