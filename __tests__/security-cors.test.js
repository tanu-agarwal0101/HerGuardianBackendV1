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
      return { userId: "user-1", email: "user@example.com" };
    }),
  },
}));

import mockPrisma from "../__mocks__/prisma.js";
const { default: app } = await import("../app.js");

describe("Security (CORS/Helmet)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("CORS origin test", async () => {
    const res = await request(app)
      .get("/")
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  test("Helmet headers presence", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
