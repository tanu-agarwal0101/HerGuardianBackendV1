import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) =>{

    logger.error({ err }, "Unhandled error");

    const statusCode = err.statusCode || err.status || 500;
    
    let message = err.message || "An unexpected error occurred. Please try again.";
    
    if (statusCode === 500) {
        message = "Something went wrong on our end. Our dedicated team has been notified.";
        if (err.name?.includes("Prisma") || err.code?.startsWith("P")) {
            message = "Database connection error. Please try again later.";
        }
    }

    res.status(statusCode).json({
        message
    })
}