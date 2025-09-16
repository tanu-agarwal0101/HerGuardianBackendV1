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

describe("GET /", () => {
  it("responds with 200 and welcome HTML", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Welcome to HerGuardian");
  });
});
