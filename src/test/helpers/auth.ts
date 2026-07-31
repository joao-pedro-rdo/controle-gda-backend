import type { FastifyInstance } from "fastify";

type LoginPayload = {
  login: string;
  password: string;
};

export async function loginAndGetCookie(
  app: FastifyInstance,
  payload: LoginPayload,
) {
  const response = await app.inject({
    method: "POST",
    url: "/login",
    payload,
  });

  const accessTokenCookie = response.cookies.find(
    (cookie) => cookie.name === "accessToken",
  );

  return {
    response,
    cookieHeader: accessTokenCookie
      ? `${accessTokenCookie.name}=${accessTokenCookie.value}`
      : "",
  };
}
