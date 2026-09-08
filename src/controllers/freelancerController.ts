import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { freelancerService } from '../services/freelancerService';
import { profileService } from '../services/profileService';
import { sequelize } from '../database';
import { User } from '../models/User';
import { Freelancer } from '../models/Freelancer';
import { AgencyMemberFreelancer } from '../models/AgencyMemberFreelancer';
import { AuthRequest } from '../middlewares/auth';
import { inFreelancerScope } from '../helpers/agencyScope';

/**
 * Garante que o usuário (agência dona OU líder) pode gerenciar aquele colaborador:
 * mesma agência + (para líder) dentro do escopo. Admin e o próprio colaborador passam direto.
 * Devolve o colaborador carregado, ou responde 403/404 e devolve null.
 */
async function loadManageableFreelancer(req: AuthRequest, res: Response, id: string) {
  const freelancer = await freelancerService.getFreelancerById(id);
  if (!freelancer) {
    res.status(404).json({ message: 'Colaborador não encontrado.' });
    return null;
  }
  const role = req.user!.role;
  if (role === 'admin') return freelancer;
  if (role === 'freelancer') {
    const own = await profileService.freelancerForUser(req.user!);
    if (!own || own.id !== freelancer.id) {
      res.status(403).json({ message: 'Você só pode gerenciar o seu próprio perfil.' });
      return null;
    }
    return freelancer;
  }
  const actor = await profileService.agencyContextForUser(req.user!);
  if (!actor || freelancer.agencyId !== actor.agencyId) {
    res.status(403).json({ message: 'Este colaborador não pertence à sua agência.' });
    return null;
  }
  if (!inFreelancerScope(actor, freelancer.id)) {
    res.status(403).json({ message: 'Este colaborador está fora do seu grupo de trabalho.' });
    return null;
  }
  return freelancer;
}

export const freelancerController = {
  async create(req: Request, res: Response) {
    try {
      const freelancer = await freelancerService.createFreelancer(req.body);
      return res.status(201).json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao criar freelancer.' });
    }
  },

  // POST /agency/freelancers — agência (ou líder) cadastra um colaborador na própria agência
  async createForMyAgency(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!);
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' });

      const { name, email, password, phone, skills } = req.body ?? {};
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Informe nome, e-mail e senha do freelancer.' });
      }
      const exists = await User.findOne({ where: { email } });
      if (exists) return res.status(409).json({ message: 'E-mail já cadastrado.' });

      const freelancer = await sequelize.transaction(async (t) => {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create(
          { name, email, passwordHash, role: 'freelancer', phone: phone ?? null },
          { transaction: t }
        );
        const created = await Freelancer.create(
          { userId: user.id, agencyId: actor.agencyId, name, email, phone: phone ?? undefined, skills: skills ?? undefined },
          { transaction: t }
        );
        // Líder com escopo restrito: o colaborador que ele cadastra entra no escopo dele.
        if (actor.memberId && actor.scopeFreelancerIds) {
          await AgencyMemberFreelancer.create(
            { agencyMemberId: actor.memberId, freelancerId: created.id },
            { transaction: t }
          );
        }
        return created;
      });

      return res.status(201).json(freelancer);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao cadastrar freelancer.' });
    }
  },

  // POST /freelancer/profile-photo (multipart, campo "photo") — o próprio colaborador envia a foto de perfil
  async uploadProfilePhoto(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!);
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' });
      if (!req.file) return res.status(400).json({ message: 'Envie a foto de perfil.' });
      const updated = await freelancerService.setProfilePhoto(freelancer.id, `/uploads/${req.file.filename}`);
      return res.json(updated);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao enviar foto de perfil.' });
    }
  },

  // GET /freelancers — admin vê todos; agência/líder vê só a rede (líder: só o escopo dele).
  async index(req: AuthRequest, res: Response) {
    try {
      if (req.user!.role === 'admin') {
        return res.json(await freelancerService.getAllFreelancers());
      }
      const actor = await profileService.agencyContextForUser(req.user!);
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.getFreelancersForAgency(actor.agencyId, actor));
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar freelancers.' });
    }
  },

  // GET /freelancers/:id — admin qualquer um; agência/líder só a rede/escopo; freelancer só o próprio.
  async show(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      return res.json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao buscar freelancer.' });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      const updated = await freelancerService.updateFreelancer(req.params.id, req.body);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao atualizar freelancer.' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const deleted = await freelancerService.deleteFreelancer(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      return res.json({ message: 'Freelancer deletado com sucesso.' });
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao deletar freelancer.' });
    }
  },

  async listCategories(req: Request, res: Response) {
    try {
      const categories = await freelancerService.getFreelancerCategories(req.params.id);
      return res.json(categories);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar categorias do freelancer.' });
    }
  },

  async addCategory(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      const result = await freelancerService.addCategoryToFreelancer(
        req.params.id,
        req.body.categoryId,
        req.body.hourlyRate
      );
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao adicionar função ao colaborador.' });
    }
  },

  // PUT /freelancers/:id/categories/:category_id — define o valor/hora da função
  async setCategoryRate(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      const result = await freelancerService.setCategoryRate(
        req.params.id,
        req.params.category_id,
        req.body.hourlyRate
      );
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao definir o valor/hora.' });
    }
  },

  async removeCategory(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      const removed = await freelancerService.removeCategoryFromFreelancer(req.params.id, req.params.category_id);
      if (!removed) return res.status(404).json({ message: 'Relação freelancer-categoria não encontrada.' });

      return res.json({ message: 'Categoria removida do freelancer.' });
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao remover categoria do freelancer.' });
    }
  },

  // GET /agency/pending-freelancers — autocadastros aguardando aprovação da minha agência
  async listPendingForMyAgency(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!);
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.listPendingForAgency(actor.agencyId, actor));
    } catch (err) {
      return res.status(500).json({ message: err instanceof Error ? err.message : 'Erro ao listar cadastros pendentes.' });
    }
  },

  // POST /agency/freelancers/:id/approve
  async approveFreelancer(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      return res.json(await freelancerService.approveRegistration(req.params.id, freelancer.agencyId as string));
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao aprovar cadastro.' });
    }
  },

  // POST /agency/freelancers/:id/reject
  async rejectFreelancer(req: AuthRequest, res: Response) {
    try {
      const freelancer = await loadManageableFreelancer(req, res, req.params.id);
      if (!freelancer) return;
      return res.json(await freelancerService.rejectRegistration(req.params.id, freelancer.agencyId as string));
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao recusar cadastro.' });
    }
  },
};
