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
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const { default: app } = await import("../app.js");

import mockPrisma from "../__mocks__/prisma.js";



describe("CORS preflight handling", () => {
  test("responds to OPTIONS with correct CORS headers for allowed origin", async () => {
    const origin = process.env.FRONTEND_URL;
    const res = await request(app)
      .options("/users/profile")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Content-Type");

    // default status for preflight is 204
    expect([200, 204]).toContain(res.status);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
