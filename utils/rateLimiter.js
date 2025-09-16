import rateLimit from "express-rate-limit";


const alertRateLimit = {}
// {ip: timestamps[]}

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes


export function rateLimiter(req, res, next){
    const ip= req.ip;
    const now = Date.now();
    const timestamps = alertRateLimit[ip] || [];
    
    const recent = timestamps.filter(ts => now-ts < RATE_LIMIT_WINDOW) //Removes old requests that happened outside the last 5 minutes.
    if(recent.length >= RATE_LIMIT_MAX){
        return res.status(429).json({
            message: "too many alerts. please wait a few minutes"
        })
    }

    alertRateLimit[ip] = [...recent, now]
    next()
}


export const rateLimiterLib = rateLimit({
    windowMs: 5*60*1000,
    max: 3,
    message: "too many alerts triggered. please wait a few minutes"
})