import { prisma } from "../lib/prisma.js";

export interface UserWithPassword {
  id: number;
  login: string;
  password: string;
  role: string;
}

export interface PublicUser {
  id: number;
  login: string;
  role: string;
}

export interface UserRepository {
  findMany(): Promise<PublicUser[]>;
  findByLogin(login: string): Promise<UserWithPassword | null>;
  findById(id: number): Promise<PublicUser | null>;
  create(data: {
    login: string;
    password: string;
    role: string;
  }): Promise<PublicUser>;
  update(
    id: number,
    data: { login?: string; password?: string; role?: string }
  ): Promise<PublicUser>;
  delete(id: number): Promise<PublicUser>;
}

const publicUserSelect = {
  id: true,
  login: true,
  role: true,
} as const;

export const prismaUserRepository: UserRepository = {
  findMany() {
    return prisma.user.findMany({ select: publicUserSelect });
  },

  findByLogin(login) {
    return prisma.user.findUnique({ where: { login } });
  },

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  },

  create(data) {
    return prisma.user.create({
      data,
      select: publicUserSelect,
    });
  },

  update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  },

  delete(id) {
    return prisma.user.delete({
      where: { id },
      select: publicUserSelect,
    });
  },
};
