import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../utils/prisma.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";

const updateStealth = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { stealthMode, stealthType } = req.body;

  const isUserValid = await checkUserId(userId);
  if (!isUserValid) {
    return res.status(statusCode.NotFound404).json({
      message: "user not found"
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stealthMode,
      stealthType
    }
  });

  // ✅ Set non-HttpOnly cookies so frontend + middleware can read them
  res.clearCookie("stealthMode", {
  path: "/",
  sameSite: "Strict",
  secure: process.env.NODE_ENV === "production",
});
res.clearCookie("stealthType", {
  path: "/",
  sameSite: "Strict",
  secure: process.env.NODE_ENV === "production",
});

  res.cookie("stealthMode", stealthMode.toString(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/"
  });

  res.cookie("stealthType", stealthType || "calculator", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/"
  });

  return res.status(statusCode.Ok200).json({
    message: "Stealth settings updated and cookies set"
  });
});


const getProfile = asyncHandler(async(req, res)=>{
    const user = req.user
    res.json({
        id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    stealthMode: user.stealthMode,
    stealthType: user.stealthType,
    })
})

const getAllUsers = asyncHandler(async(req, res)=>{
    const users = await prisma.user.findMany({
        select: {
            email: true,
            createdAt: true
        }
    })

    return res.status(statusCode.Ok200).json({users})
})

export {
    updateStealth, getProfile, getAllUsers
}