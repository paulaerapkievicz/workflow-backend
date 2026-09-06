import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { freelancerService } from '../services/freelancerService';
import { profileService } from '../services/profileService';
import { sequelize } from '../database';
import { User } from '../models/User';
import { Freelancer } from '../models/Freelancer';
import { AuthRequest } from '../middlewares/auth';

export const freelancerController = {
  async create(req: Request, res: Response) {
    try {
      const freelancer = await freelancerService.createFreelancer(req.body);
      return res.status(201).json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao criar freelancer.' });
    }
  },

  // POST /agency/freelancers — agência cadastra um freelancer (usuário + perfil) na própria agência
  async createForMyAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });

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
        return Freelancer.create(
          { userId: user.id, agencyId, name, email, phone: phone ?? undefined, skills: skills ?? undefined },
          { transaction: t }
        );
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

  // GET /freelancers — admin vê todos; agência vê só os da própria rede.
  async index(req: AuthRequest, res: Response) {
    try {
      if (req.user!.role === 'admin') {
        return res.json(await freelancerService.getAllFreelancers());
      }
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.getFreelancersForAgency(agencyId));
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao listar freelancers.' });
    }
  },

  // GET /freelancers/:id — admin vê qualquer um; agência só os da própria rede; freelancer só o próprio.
  async show(req: AuthRequest, res: Response) {
    try {
      const freelancer = await freelancerService.getFreelancerById(req.params.id);
      if (!freelancer) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      if (req.user!.role === 'agency') {
        const agencyId = await profileService.agencyIdForUser(req.user!);
        if (!agencyId || freelancer.agencyId !== agencyId) {
          return res.status(403).json({ message: 'Este colaborador não pertence à sua agência.' });
        }
      } else if (req.user!.role === 'freelancer') {
        const own = await profileService.freelancerForUser(req.user!);
        if (!own || own.id !== freelancer.id) {
          return res.status(403).json({ message: 'Você só pode ver o seu próprio perfil.' });
        }
      }

      return res.json(freelancer);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao buscar freelancer.' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const updatedFreelancer = await freelancerService.updateFreelancer(req.params.id, req.body);
      if (!updatedFreelancer) return res.status(404).json({ message: 'Freelancer não encontrado.' });

      return res.json(updatedFreelancer);
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

  async addCategory(req: Request, res: Response) {
    try {
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
  async setCategoryRate(req: Request, res: Response) {
    try {
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

  async removeCategory(req: Request, res: Response) {
    try {
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
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.listPendingForAgency(agencyId));
    } catch (err) {
      return res.status(500).json({ message: err instanceof Error ? err.message : 'Erro ao listar cadastros pendentes.' });
    }
  },

  // POST /agency/freelancers/:id/approve
  async approveFreelancer(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.approveRegistration(req.params.id, agencyId));
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao aprovar cadastro.' });
    }
  },

  // POST /agency/freelancers/:id/reject
  async rejectFreelancer(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!);
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' });
      return res.json(await freelancerService.rejectRegistration(req.params.id, agencyId));
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao recusar cadastro.' });
    }
  },
};
