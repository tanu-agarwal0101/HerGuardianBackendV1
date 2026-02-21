import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createAddress, deleteAddress, updateAddress, getAllAddresses } from "../controllers/addressController.js";
import { validateSchema } from "../utils/validators.js";
import { createAddressSchema, updateAddressSchema } from "../schemas/address.js";

const router = Router();
router.post("/create-address", authMiddleware, validateSchema(createAddressSchema), createAddress);
router.patch("/update-address", authMiddleware, validateSchema(updateAddressSchema), updateAddress);
router.delete("/delete-address", authMiddleware, deleteAddress);
router.get("/get-all-addresses", authMiddleware, getAllAddresses);

export default router;