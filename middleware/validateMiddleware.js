import {ZodError} from "zod"

export function validate(schema){
    return (req, res, next)=>{
        try {
            const validateData = schema.parse(req.body);
            req.validateBody = validateData;
            next();
        } catch (error) {
            if(error instanceof ZodError){
                return res.status(400).json({
                    message: "validation failed",
                    errors: error.errors
                })
            }

            console.error(error);
            return res.status(500).json({ message: "Internal Server Error"})
        }
    }
}


// If later you want to validate req.query or req.params, we can extend this middleware.

// For now, start with request body — it's 90% of your work.