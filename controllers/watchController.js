import { asyncHandler } from "../utils/asyncHandler.js";
import { triggerSOS } from "../utils/triggerSos.js";

const HEART_RATE_THRESHOLD = 14;

const watchPullData = asyncHandler(async (req, res) => {
   const userId = req.user?.userId || req.body.userId;
  const { heartRate, location, fallDetected, triggeredAt } = req.body;

  console.log("📡 Incoming watch data:", req.body);

  if (!heartRate || !location?.lat || !location?.lon) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let sosTriggered = false;

  if (heartRate > HEART_RATE_THRESHOLD || fallDetected) {
    await triggerSOS(userId, location, triggeredAt);
    sosTriggered = true;
  }

  res.json({
    message: sosTriggered ? "SOS triggered" : "Data received successfully",
  });
});

export { watchPullData };
