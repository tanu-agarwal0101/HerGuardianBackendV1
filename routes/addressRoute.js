import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createAddress, deleteAddress, updateAddress, getAllAddresses } from "../controllers/addressController.js";

const router = Router();
router.post("/create-address", authMiddleware, createAddress);
router.patch("/update-address", updateAddress);
router.delete("/delete-address", deleteAddress);
router.get("/get-all-addresses", authMiddleware, getAllAddresses)

export default router;