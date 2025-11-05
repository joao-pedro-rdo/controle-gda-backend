import { prisma } from "../helpers/utils.js";

export const index = async (req, reply) => {
  try {
    const allEntries = await prisma.user.findMany();
    reply.status(200).send(allEntries);
  } catch (error) {
    console.log(error);
  }
};

// export const getUserById = async (req, reply) => {
//   const toEditUser = await prisma.user.findUnique({
//     where: {
//       id: +req.params.id,
//     },
//   });

//   if (!toEditUser) {
//     reply.status(404).send("Usuário não encontrado");
//   }
//   reply.status(200).send(toEditUser);
// };

// export const createUser = async (req, reply) => {
//   try {
//     const { user, password, role } = req.body;
//     const newUser = await prisma.user.create({
//       data: {
//         user,
//         password,
//         role,
//       },
//     });
//     reply.status(201).send(newUser);
//   } catch (error) {
//     console.log(error);
//   }
// };

// export const deleteUser = async (req, reply) => {
//   const deletedUser = await prisma.user.delete({
//     where: {
//       id: +req.params.id,
//     },
//   });
//   reply.send(deletedUser);
// };

// export const updateUser = async (req, reply) => {
//   try {
//     const { user, password, role } = req.body;

//     const newUser = await prisma.user.update({
//       where: {
//         id: +req.params.id,
//       },
//       data: {
//         user,
//         password,
//         role,
//       },
//     });
//     reply.send(newUser);
//   } catch (error) {
//     console.log(error);
//   }
// };
