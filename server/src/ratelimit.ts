import rateLimit from "express-rate-limit";
import { TIMEOUT } from "./data";

export const placeLimiter = rateLimit({
    windowMs: TIMEOUT * 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: true
});
export const stateLimiter = rateLimit({
    windowMs: 20 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: true
})
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: true
})
