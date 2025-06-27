import prisma from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
};
import { ObjectId } from "mongodb";


const generateTokens = async (user) => {
    const parseExpiry = (envVar, fallback) => {
  const trimmed = (envVar || '').trim();
  return trimmed || fallback;
}
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: parseExpiry(process.env.ACCESS_TOKEN_EXPIRY, "1d"),
    }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: parseExpiry(process.env.REFRESH_TOKEN_EXPIRY, "10d"),
    }
  );

  const createdAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(createdAt.getDate() + 10);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      createdAt,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
    // console.log("data", req.body)
  const { email, password } = req.validateData;

  console.log("email", email, password)
  // const errors =[]
//   if (!email || !password) {
//     return res
//       .status(statusCode.BadRequest400)
//       .json({ message: "Email and password are required" });
//   }
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//   if (!emailRegex.test(email)) {
//     return res
//       .status(statusCode.BadRequest400)
//       .json({ message: "Invalid email address." });
//   }
//   const passwordValidation = validatePassword(password);
//   if (!passwordValidation.isValid) {
//     return res
//       .status(statusCode.BadRequest400)
//       .json({ message: passwordValidation.errors });
//   }
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    return res
      .status(statusCode.Conflict409)
      .json({ message: "User already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  const { accessToken, refreshToken } = await generateTokens(user);

  return res
    .status(statusCode.Created201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({
      message: "User created successfully",
      user: { id: user.id, email: user.email },
    });
});

const loginUser = asyncHandler(async (req, res) => {
    
  const { email, password } = req.validateData;
  if (!email || !password) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "Email and password are required" });
  }
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user)
    return res.status(statusCode.NotFound404).json({
      message: "user with this mail does not exist",
    });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(statusCode.BadRequest400).json({
      message: "Invalid password",
    });
  }
  const { accessToken, refreshToken } = await generateTokens(user);
//   console.log(generateTokens(user))
  return res
    .status(statusCode.Ok200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({
      message: "User logged in successfully",
      user: {email: user.email, phoneNumber: user.phoneNumber, firstName: user.firstName, lastName: user.lastName},
    });
});

const logoutUser = asyncHandler(async (req, res) => {
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  if (accessToken) {
    await prisma.blackListToken.create({
      data: {
        token: accessToken,
      },
    });
  }

  if (refreshToken) {
    await prisma.blackListToken.create({
      data: {
        token: refreshToken,
      },
    });
  }

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res.status(statusCode.Ok200).json({
    message: "user logged out successfully",
  });
});

const onboardUser = asyncHandler(async (req, res) => {
    // console.log("data", req.validateData)
  const { firstName, lastName, phoneNumber } = req.body;
  console.log("req", req.user)
  const userId = req.user?.userId;
//   console.log("userId before casting:", userId)
// console.log("isValidObjectId:", ObjectId.isValid(userId))
  if (!firstName || !lastName || !phoneNumber) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "All fields are required" });
  }

  const phoneRegex = /^[0-9]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "Invalid phone number format" });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // where: { id: new ObjectId(userId) },
  if (!user) {
    return res
      .status(statusCode.NotFound404)
      .json({ message: "User not found" });
  }
  //   if (!firstName.trim() || !lastName.trim()) {
  //     return res
  //       .status(statusCode.BadRequest400)
  //       .json({ message: "First name and last name cannot be empty" });
  //   }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber,
    },
  });
  const { password, ...sanitizedUser } = updatedUser;

  return res
    .status(statusCode.Ok200)
    .json({ message: "User updated successfully", user: sanitizedUser });
});

export { registerUser, loginUser, logoutUser, onboardUser };
