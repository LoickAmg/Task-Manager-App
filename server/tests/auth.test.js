import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";
import { loginAsNewUser } from "./helpers.js";

describe("auth", () => {
  it("refuse un login avec un mauvais mot de passe", async () => {
    await loginAsNewUser({ email: "a@example.com", password: "correct-horse" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("refuse un login pour un email inconnu", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });
    expect(res.status).toBe(401);
  });

  it("valide le login avec les bons identifiants et fixe un cookie de session", async () => {
    await loginAsNewUser({ email: "b@example.com", password: "s3cret!!" });
    const res = await request(app).post("/api/auth/login").send({ email: "b@example.com", password: "s3cret!!" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("b@example.com");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("/me renvoie 401 sans session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("/me renvoie l'utilisateur courant avec une session valide", async () => {
    const { agent, user } = await loginAsNewUser({ email: "c@example.com" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it("logout invalide la session", async () => {
    const { agent } = await loginAsNewUser({ email: "d@example.com" });
    await agent.post("/api/auth/logout").expect(204);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
