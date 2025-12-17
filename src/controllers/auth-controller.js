import {
  comparePassword,
  createAccessToken,
  hashPassword,
  prisma,
} from "../helpers/utils.js";
// 📊 Importar métricas do Prometheus
import { incrementLoginAttempts } from "../helpers/prometheus.js";

export const signup = async (req, reply) => {
  const { login, role, password: pass } = req.body;

  try {
    const hashedPassword = await hashPassword(pass);
    const newUser = await prisma.user.create({
      data: {
        password: hashedPassword,
        login,
        role,
      },
    });
    let { password, ...data } = newUser;
    reply.send(data);
  } catch (error) {
    console.log(error);
    reply.status(400).send({ error: "Usuário já existe" });
  }
};

export const login = async (req, reply) => {
  try {
    const { login, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { login },
      select: { id: true, login: true, password: true, role: true },
    });

    if (!user) {
      // 📊 PROMETHEUS: Login falhou (usuário não encontrado)
      incrementLoginAttempts("failed", null);
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      // 📊 PROMETHEUS: Login falhou (senha incorreta)
      incrementLoginAttempts("failed", user.role);
      return reply.status(401).send({ error: "Credenciais inválidas" });
    }

    const accessToken = await createAccessToken(user);
    console.log("🍪 Criando cookie para ambiente Nginx");

    reply.setCookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false, // Para desenvolvimento
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
      path: "/", // Disponível para toda a aplicação
      // 🔧 REMOVER domain - deixar Nginx gerenciar
    });

    console.log("✅ Cookie criado para proxy Nginx");

    // 📊 PROMETHEUS: Login bem-sucedido
    incrementLoginAttempts("success", user.role);

    const { password: _, ...userWithoutPassword } = user;

    reply.status(200).send({
      message: "Login realizado com sucesso",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Erro no login:", error);
    reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const deleteUser = async (req, reply) => {
  const deletedUser = await prisma.user.delete({
    where: {
      id: +req.params.id,
    },
  });
  reply.send(deletedUser);
};

export const updateUser = async (req, reply) => {
  try {
    const { login, password: pass, role } = req.body;
    const hashedPassword = await hashPassword(pass);

    const newUser = await prisma.user.update({
      where: {
        id: +req.params.id,
      },
      data: {
        login,
        password: hashedPassword,
        role,
      },
    });
    reply.send(newUser);
  } catch (error) {
    console.log(error);
  }
};

export const updPass = async (req, reply) => {
  try {
    const { login, oldPass, newPass } = req.body;

    let loginUser = await prisma.user.findUnique({ where: { login } });

    if (!(await comparePassword(oldPass, loginUser.password))) {
      return reply.status(200).send({ error: "Senha antiga não confere" });
    }

    const password = await hashPassword(newPass);
    const newUser = await prisma.user.update({
      where: {
        id: +req.params.id,
      },
      data: {
        password,
      },
    });
    reply.send(newUser);
  } catch (error) {
    console.log(error);
  }
};

// 🔒 NOVA FUNÇÃO: Logout com limpeza de cookie
export const logout = async (req, reply) => {
  try {
    reply.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    reply.status(200).send({ message: "Logout realizado com sucesso" });
  } catch (error) {
    reply.status(500).send({ error: "Erro no logout" });
  }
};

// 🔒 NOVA FUNÇÃO: Verificar autenticação
export const checkAuth = async (req, reply) => {
  try {
    const { password: _, ...userWithoutPassword } = req.user;

    reply.status(200).send({
      authenticated: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    reply.status(401).send({ authenticated: false });
  }
};
