import { Request, Response } from 'express';
import { userService } from '../services/userService';

// GET /users - Lista todos os usuários
export const userController = {
  async index(req: Request, res: Response) {
    try {
      const users = await userService.getAllUsers();
      return res.json(users);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao buscar usuários.' });
    }
  },

  // GET /users/:id - Busca um usuário pelo ID
  async show(req: Request, res: Response) {
    try {
      const user = await userService.getUserById(req.params.id);
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

      return res.json(user);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao buscar usuário.' });
    }
  },

  // POST /users - Cria um novo usuário
  async create(req: Request, res: Response) {
    try {
      const newUser = await userService.createUser(req.body);
      return res.status(201).json(newUser);
    } catch (err) {
      if (err instanceof Error && err.message.includes('unique violation')) {
        return res.status(409).json({ message: 'E-mail já está em uso.' });
      }
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao criar usuário.' });
    }
  },

  // PUT /users/:id - Atualiza um usuário pelo ID
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, role } = req.body; // Apenas permite editar esses campos

      const updatedUser = await userService.updateUser(id, { name, role });
      if (!updatedUser) return res.status(404).json({ message: 'Usuário não encontrado.' });

      return res.json(updatedUser);
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao atualizar usuário.' });
    }
  },

  // DELETE /users/:id - Exclui um usuário pelo ID
  async delete(req: Request, res: Response) {
    try {
      const deleted = await userService.deleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Usuário não encontrado.' });

      return res.json({ message: 'Usuário deletado com sucesso.' });
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao deletar usuário.' });
    }
  },
};
