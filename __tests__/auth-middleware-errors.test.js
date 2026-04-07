import { jest } from "@jest/globals";
import request from "supertest";

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrismaInstance = (await import("../__mocks__/prisma.js")).default;
  return { default: mockPrismaInstance };
});

await jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(() => "new.access"),
    verify: jest.fn((token) => {
      if (token === "bad") {
        const err = new Error("invalid token");
        err.name = "JsonWebTokenError";
        throw err;
      }
      if (token === "expired") {
        const err = new Error("jwt expired");
        err.name = "TokenExpiredError";
        throw err;
      }
      return { userId: "user-1", email: "user@example.com" };
    }),
  },
}));

import mockPrisma from "../__mocks__/prisma.js";
const { default: app } = await import("../app.js");

describe("authMiddleware error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.blackListToken.findFirst.mockResolvedValue(null);
  });

  test("401 when access token missing", async () => {
    const res = await request(app).get("/users/profile");
    expect(res.status).toBe(401);
  });

  test("401 when access token is bad", async () => {
    const res = await request(app)
      .get("/users/profile")
      .set("Cookie", ["accessToken=bad"]);
    expect(res.status).toBe(401);
  });

  test("401 when access token is expired", async () => {
    const res = await request(app)
      .get("/users/profile")
      .set("Cookie", ["accessToken=expired; refreshToken=expired"]);
    expect(res.status).toBe(401);
  });
});
