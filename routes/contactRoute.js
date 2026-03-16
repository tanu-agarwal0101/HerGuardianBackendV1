import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createEmergencyContact, deleteContact, updateEmergencyContact, getAllContactsByUserId, addSingleEmergencyContact } from "../controllers/contactsController.js";
import {SingleEmergencyContactSchema, EmergencyContactsArraySchema, updateContactSchema, deleteContactSchema} from "../schemas/emergencyContact.js"
import {validateSchema} from "../utils/validators.js"


const router = Router();

router.post("/create-contacts", authMiddleware, validateSchema(EmergencyContactsArraySchema), createEmergencyContact);

router.post("/add-single-contact", authMiddleware, validateSchema(SingleEmergencyContactSchema), addSingleEmergencyContact)

router.patch("/update-emergency-contact", authMiddleware, validateSchema(updateContactSchema), updateEmergencyContact);
router.delete("/delete-contact", authMiddleware, validateSchema(deleteContactSchema), deleteContact);
router.get("/get-all-contacts", authMiddleware, getAllContactsByUserId);

export default router;