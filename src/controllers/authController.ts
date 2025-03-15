// import { Request, Response } from 'express'
// import { userService } from '../services/userService'
// import { jwtService } from '../services/jwtService'

// export const authController = {
//   // POST /auth/register
//   register: async (req: Request, res: Response) => {
//     const { firstName, lastName, phone, birth, email, password } = req.body

//     try {
//       const userAlreadyExists = await userService.findByEmail(email)

//       if (userAlreadyExists) {
//         throw new Error('Este e-mail já está cadastrado.')
//       }

//       const user = await userService.create({
//         firstName,
//         lastName,
//         phone,
//         birth,
//         email,
//         password,
//         role: 'user'
//       })

//       return res.status(201).json(user)
//     } catch (err) {
//       if (err instanceof Error) {
//         return res.status(400).json({ message: err.message })
//       }
//     }
//   },

//   // POST /auth/login
// login: async(req: Request, res: Response) => {
//   const { email, password } = req.body

//   try {
//     const user = await userService.findByEmail(email)

//     if (!user) {
//       return res.status(404).json({ message: 'E-mail não registrado' })
//     }

//     user.checkPassword(password, (err, isSame) => {
//       if (err) {
//         return res.status(400).json({ message: err.message })
//       }

//       if (!isSame) {
//         return res.status(401).json({ message: 'Senha incorreta' })
//       }

//       const payload = {
//         id: user.id,
//         firstName: user.firstName,
//         email: user.email
//       }

//       const token = jwtService.signToken(payload, '7d')

//       return res.json({ authenticated: true, ...payload, token })
//     })
//   } catch (err) {
//     if (err instanceof Error) {
//       return res.status(400).json({ message: err.message })
//     }
//   }
// }
// }


// // import { Request, Response } from 'express';
// // import { userService } from '../services/userService';
// // import { jwtService } from '../services/jwtService';
// // import bcrypt from 'bcrypt';

// // export const authController = {
// //   // POST /auth/register - Cadastro de usuário
// //   register: async (req: Request, res: Response) => {
// //     const { firstName, lastName, phone, birth, email, password, role } = req.body;

// //     try {
// //       // Verifica se o e-mail já está cadastrado
// //       const userAlreadyExists = await userService.findByEmail(email);
// //       if (userAlreadyExists) {
// //         return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
// //       }

// //       // Criação do usuário com hash de senha
// //       const hashedPassword = await bcrypt.hash(password, 10);
// //       const user = await userService.create({
// //         firstName,
// //         lastName,
// //         phone,
// //         birth,
// //         email,
// //         password: hashedPassword,
// //         role
// //       });

// //       return res.status(201).json(user);
// //     } catch (err) {
// //       if (err instanceof Error) {
// //         return res.status(400).json({ message: err.message });
// //       }
// //     }
// //   },

// //   // POST /auth/login - Autenticação de usuário
// //   login: async (req: Request, res: Response) => {
// //     const { email, password } = req.body;

// //     try {
// //       // Verifica se o e-mail está cadastrado
// //       const user = await userService.findByEmail(email);
// //       if (!user) {
// //         return res.status(404).json({ message: 'E-mail não registrado' });
// //       }

// //       // Verifica se a senha está correta
// //       const isSame = await bcrypt.compare(password, user.password);
// //       if (!isSame) {
// //         return res.status(401).json({ message: 'Senha incorreta' });
// //       }

// //       // Geração do token JWT
// //       const payload = {
// //         id: user.id,
// //         firstName: user.firstName,
// //         email: user.email,
// //         role: user.role
// //       };
// //       const token = jwtService.signToken(payload, '7d');

// //       return res.json({ authenticated: true, ...payload, token });
// //     } catch (err) {
// //       if (err instanceof Error) {
// //         return res.status(400).json({ message: err.message });
// //       }
// //     }
// //   },

// //   // POST /auth/logout - Logout do usuário
// //   logout: async (_req: Request, res: Response) => {
// //     try {
// //       return res.json({ authenticated: false, token: null });
// //     } catch (err) {
// //       if (err instanceof Error) {
// //         return res.status(400).json({ message: err.message });
// //       }
// //     }
// //   },

// //   // POST /auth/refresh-token - Renovação do token JWT
// //   refreshToken: async (req: Request, res: Response) => {
// //     const { token } = req.body;

// //     try {
// //       if (!token) {
// //         return res.status(400).json({ message: 'Token não fornecido' });
// //       }

// //       jwtService.verifyToken(token, (err, decoded) => {
// //         if (err) {
// //           return res.status(401).json({ message: 'Token inválido ou expirado' });
// //         }

// //         const newToken = jwtService.signToken(decoded as object, '7d');
// //         return res.json({ token: newToken });
// //       });
// //     } catch (err) {
// //       if (err instanceof Error) {
// //         return res.status(400).json({ message: err.message });
// //       }
// //     }
// //   }
// // };
