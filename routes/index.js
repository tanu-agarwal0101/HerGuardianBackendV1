import express from "express";
import authRoute from "./authRoute.js";
import contactRoute from "./contactRoute.js";
import addressRoute from "./addressRoute.js";
import chatBotSocket from "./chatbotRoutes.js";
import timerRoute from "./timerRoute.js"
import userRoute from "./userRoutes.js"

const router = express.Router();

router.use("/", authRoute)
router.use("/", contactRoute)
router.use("/", addressRoute)
router.use("/", userRoute)
router.use("/", timerRoute)
// router.use("/", chatBotSocket)

export {
    authRoute, addressRoute, contactRoute,
    timerRoute,
    userRoute
}