import express from "express";
import authRoute from "./authRoute.js";
import contactRoute from "./contactRoute.js";
import addressRoute from "./addressRoute.js";
import chatBotSocket from "./chatbotRoutes.js";
import timerRoute from "./timerRoute.js"
import userRoute from "./userRoutes.js"
import watchRoute from "./watchRoute.js"
import notificationRoutes from "./notificationRoutes.js"
import locationRoute from "./locationRoute.js"
import sosRoute from "./sosRoute.js"
import excuseRoute from "./excuseRoute.js"
import guardianRoute from "./guardianRoutes.js"

const router = express.Router();

router.use("/", authRoute)
router.use("/", contactRoute)
router.use("/", addressRoute)
router.use("/", userRoute)
router.use("/", timerRoute)
router.use("/", watchRoute)
router.use("/", notificationRoutes)
router.use("/", locationRoute)
router.use("/", sosRoute)
// router.use("/", chatBotSocket)
export { authRoute, contactRoute, addressRoute, chatBotSocket, timerRoute, userRoute, watchRoute, notificationRoutes, locationRoute, sosRoute, excuseRoute, guardianRoute };