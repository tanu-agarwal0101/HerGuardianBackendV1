import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createEmergencyContact, deleteContact, updateEmergencyContact, getAllContactsByUserId, addSingleEmergencyContact } from "../controllers/contactsController.js";
import {SingleEmergencyContactSchema, EmergencyContactsArraySchema} from "../schemas/emergencyContact.js"
import {validateSchema} from "../utils/validators.js"


const router = Router();

router.post("/create-contacts", authMiddleware, validateSchema(EmergencyContactsArraySchema), createEmergencyContact);

router.post("/add-single-contact", authMiddleware, validateSchema(SingleEmergencyContactSchema), addSingleEmergencyContact)

router.patch("/update-emergency-contact", authMiddleware, updateEmergencyContact);
router.delete("/delete-contact", authMiddleware, deleteContact);
router.get("/get-all-contacts", authMiddleware, getAllContactsByUserId);

export default router;