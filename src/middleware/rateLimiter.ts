import rateLimit from "express-rate-limit";

/**
 * General API rate limiter to prevent basic DDoS and excessive polling.
 * Permits 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: "Too many requests from this IP. Please try again after 15 minutes."
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

/**
 * Strict rate limiter for room generation endpoints.
 * Permits exactly 5 room creations per hour per IP.
 */
export const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: "Room creation threshold exceeded. Please try again after an hour to preserve server resources."
  },
  standardHeaders: true,
  legacyHeaders: false,
});
