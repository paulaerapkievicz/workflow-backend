// import { AuthenticationOptions } from "@adminjs/express"; 
// import User   from "../models/User";
// import bcrypt from "bcrypt";

// export const authenticationOptions: AuthenticationOptions = {
//   authenticate: async (email, password) => {
//     const user = await User.findOne({ where: { email } });

//     if (user && user.role === "admin") {
//       const matched = await bcrypt.compare(password, user.password);

//       if (matched) {
//         return {
//           id: user.id,
//           email: user.email,
//           role: user.role
//         };
//         //       if (matched) {
//         //         return user
//         //       }
//       }
//     }

//     return false;
//   },
//   //   cookiePassword: process.env.COOKIE_SECRET || "default-cookie-secret"
//   cookiePassword: 'senha-do-cookie'
// };


// // import { AuthenticationOptions } from "@adminjs/express"; 
// // import User from "../models/User";
// // import bcrypt from "bcrypt";

// // export const authenticationOptions: AuthenticationOptions = {
// //   authenticate: async (email, password) => {
// //     try {
// //       const user = await User.findOne({ where: { email } });

// //       if (!user || user.role !== "admin") {
// //         return false;
// //       }

// //       // Verifica se a senha está definida e compara
// //       if (!user.password) {
// //         return false;
// //       }

// //       const matched = await bcrypt.compare(password, user.password);

// //       if (matched) {
// //         return {
// //           id: user.id,
// //           email: user.email,
// //           role: user.role,
// //         };
// //       }

// //       return false;
// //     } catch (error) {
// //       console.error("Erro na autenticação do AdminJS:", error);
// //       return false;
// //     }
// //   },
// //   cookiePassword: process.env.COOKIE_SECRET || "senha-segura-padrao",
// // };
