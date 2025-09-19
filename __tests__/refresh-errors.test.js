import { jest } from "@jest/globals";
import request from "supertest";

await jest.unstable_mockModule("../utils/prisma.js", async () => {
  const mockPrisma = (await import("../__mocks__/prisma.js")).default;
  return { default: mockPrisma };
});

await jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(() => "new.access"),
    verify: jest.fn((token) => {
      if (token === "bad") throw new Error("invalid");
      return { userId: "user-1", email: "user@example.com" };
    }),
  },
}));

const { default: app } = await import("../app.js");

import mockPrisma from "../__mocks__/prisma.js";

describe("refresh-token errors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("401 when refresh token missing", async () => {
    const res = await request(app).post("/users/refresh-token");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("token not found");
  });

  test("403 when user not found (no such user for decoded token)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/users/refresh-token")
      .set("Cookie", ["refreshToken=ok"]);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Invalid or revoked refresh token");
  });

  test("403 when refresh token invalid", async () => {
    const res = await request(app)
      .post("/users/refresh-token")
      .set("Cookie", ["refreshToken=bad"]);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Invalid or revoked refresh token");
  });
});
