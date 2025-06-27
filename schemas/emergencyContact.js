import {z} from "zod"

export const SingleEmergencyContactSchema = z.object({    
    name: z.string().min(1),
    phoneNumber: z.string().min(10),
    relationship: z.string().optional(),
    email: z.string().email().optional()

})


export const EmergencyContactsArraySchema = z.object({
    emergencyContacts: z.array(SingleEmergencyContactSchema).min(1, "At least one contact is required")
})

// userId: z.string().length(24),