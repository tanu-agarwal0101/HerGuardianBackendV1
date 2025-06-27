import { ZodError } from "zod";

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
  
export const validateSchema = (schema)=>(req, res, next)=>{
  try {
    // console.log(schema)
    const parsed = schema.parse(req.body);
    req.validateData = parsed;
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation Error",
        errors: error.errors.map(err => {
  const path = err.path.length > 0 ? err.path.join('.') : 'field';
  return `${path} - ${err.message}`;
})
      });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkUserId = async (userId) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return !!user;
  };