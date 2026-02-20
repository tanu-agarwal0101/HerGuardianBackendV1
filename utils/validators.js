import { ZodError } from "zod";
import prisma from "./prisma.js";

export const validatePassword = (password) => {
  if (!password) {
    return {
      isValid: false,
      errors: ["Password is required"],
    };
  }

  if (typeof password !== "string") {
    return {
      isValid: false,
      errors: ["Password must be a string"],
    };
  }

  const requirements = {
    minLength: password.length >= 8,
  };

  const errorMessages = {
    minLength: "Password must be at least 8 characters long",
  };

  return {
    isValid: Object.values(requirements).every(Boolean),
    errors: Object.entries(requirements)
      .filter(([key, valid]) => !valid)
      .map(([key]) => errorMessages[key]),
  };
};

export const validateSchema = (schema) => (req, res, next) => {
  try {
    // console.log(schema)
    const parsed = schema.parse(req.body);
    req.validateData = parsed;
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation Error",
        errors: error.errors.map((err) => {
          const fmtPath = (segments) =>
            segments
              .map((seg, idx) =>
                typeof seg === "number"
                  ? `[${seg}]`
                  : idx === 0
                    ? `${seg}`
                    : `.${seg}`
              )
              .join("");
          const path =
            err.path && err.path.length > 0 ? fmtPath(err.path) : "field";
          return `${path} - ${err.message}`;
        }),
      });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkUserId = async (userId) => {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return !!user;
};
