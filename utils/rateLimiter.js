import rateLimit from "express-rate-limit";


// function rateLimiter removed due to memory leak risk
// using rateLimiterLib instead


export const rateLimiterLib = rateLimit({
    windowMs: 5*60*1000,
    max: 3,
    message: "too many alerts triggered. please wait a few minutes"
})