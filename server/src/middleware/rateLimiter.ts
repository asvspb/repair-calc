// Отключаем rate limiting полностью
const disabledLimiter = (_req: any, _res: any, next: any) => next();

// General API rate limiter - отключен
export const rateLimiter = disabledLimiter;

// Auth rate limiter - отключен
export const authRateLimiter = disabledLimiter;

// AI rate limiter - отключен
export const aiRateLimiter = disabledLimiter;
