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
      if (token === "bad") throw new Error("invalid");
      if (token === "expired") throw new Error("expired");
      return { userId: "user-1", email: "user@example.com" };
    }),
  },
}));

import mockPrisma from "../__mocks__/prisma.js";
const { default: app } = await import("../app.js");

describe("Token refresh edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /users/refresh-token -> 401 when refreshToken missing", async () => {
    const res = await request(app)
      .post("/users/refresh-token")
      .set("Cookie", ["accessToken=valid"]);
    // Controller returns 401 for !token
    expect(res.status).toBe(401);
  });

  test("POST /users/refresh-token -> 403 when token is invalid/bad", async () => {
    const res = await request(app)
      .post("/users/refresh-token")
      .set("Cookie", ["accessToken=valid; refreshToken=bad"]);
    expect(res.status).toBe(403);
  });
});
