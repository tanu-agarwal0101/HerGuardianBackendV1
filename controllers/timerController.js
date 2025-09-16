import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";

const startSafetyTimer = asyncHandler(async (req, res) => {
  // console.log("timer", req.user)
  const userId = req.user?.userId;
  const { duration, shareLocation, latitude, longitude } = req.body;
  const expiresAt = new Date(Date.now() + duration * 60 * 1000); //min to ms

  // const isUserIdValid = await checkUserId(userId);
  //     if(!isUserIdValid){
  //         return res.status(statusCode.NotFound404).json({
  //             message: "User not found"
  //         })
  //     }

  if (!(await checkUserId(userId))) {
    return res
      .status(statusCode.BadRequest400)
      .json({ message: "invalid user id" });
  }

  // Deactivate any existing active timers for this user
  await prisma.safetyTimer.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
      status: "cancelled",
    },
  });

  const timer = await prisma.safetyTimer.create({
    data: {
      userId,
      duration,
      expiresAt,
      sharedLocation: shareLocation,
      isActive: true,
      latitude,
      longitude,
    },
  });

  return res.status(statusCode.Created201).json({
    success: true,
    timer,
  });
});

// const getActiveSafetyTimer = asyncHandler(async (req, res) => {
//   const userId = req.user?.userId;

//   const activeTimer = await prisma.safetyTimer.findFirst({
//     where: {
//       userId,
//       isActive: true,
//     },
//   });

//   if (!activeTimer) {
//     return res.status(statusCode.NotFound404).json({ message: "No active timer found" });
//   }

//   return res.status(statusCode.Ok200).json({ timer: activeTimer });
// });

const cancelSafetyTimer = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  const { status } = req.body;
  const updatedTimer = await prisma.safetyTimer.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
      status,
    },
  });

  if (updatedTimer.count == 0) {
    return res.status(statusCode.NotFound404).json({
      message: "No active timer found",
    });
  }

  return res.status(statusCode.Ok200).json({
    message: "Safety timer canceled successfully",
  });
});

export { startSafetyTimer, cancelSafetyTimer };

// 5. Optional Enhancements
// Live Location sharing during timer (using WebSocket or polling).

// Notifications to user before timer expires: “Your timer is about to expire in 5 minutes”.

// Extend timer option.

// Panic button on the timer screen.

// DB Cleanup (Optional)
// You may add a cron job to delete or archive expired/inactive timers after 7 days.
