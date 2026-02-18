// Redis-backed session middleware

import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { redis } from "../redis.js";
import type { SessionData } from "../types.js";

const SESSION_PREFIX = "session";
const SESSION_TTL = 3600; // 1 hour in seconds
const COOKIE_NAME = "sid";

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      session?: SessionData;
    }
  }
}

/**
 * Session middleware — reads/creates a session ID from cookies,
 * loads session data from Redis, and saves changes after the response.
 */
export function sessionMiddleware() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let sessionId = req.cookies?.[COOKIE_NAME] as string | undefined;

      // Load existing session or create a new one
      if (sessionId) {
        const raw = await redis.get(`${SESSION_PREFIX}:${sessionId}`);
        if (raw) {
          req.session = JSON.parse(raw) as SessionData;
          req.sessionId = sessionId;
        } else {
          // Cookie exists but session expired — create new
          sessionId = undefined;
        }
      }

      if (!sessionId) {
        sessionId = uuidv4();
        req.sessionId = sessionId;
        req.session = {
          userId: "",
          username: "",
          cart: [],
          createdAt: new Date().toISOString(),
          lastAccess: new Date().toISOString(),
        };

        res.cookie(COOKIE_NAME, sessionId, {
          httpOnly: true,
          maxAge: SESSION_TTL * 1000,
          sameSite: "lax",
        });
      }

      // Update last access
      req.session!.lastAccess = new Date().toISOString();

      // Save session after response is sent
      res.on("finish", () => {
        if (req.sessionId && req.session) {
          redis
            .set(
              `${SESSION_PREFIX}:${req.sessionId}`,
              JSON.stringify(req.session),
              "EX",
              SESSION_TTL
            )
            .catch((err: Error) =>
              console.error("Failed to save session:", err.message)
            );
        }
      });

      next();
    } catch (err) {
      console.error("Session middleware error:", err);
      next();
    }
  };
}

/**
 * Destroy the current session.
 */
export async function destroySession(
  req: Request,
  res: Response
): Promise<void> {
  if (req.sessionId) {
    await redis.del(`${SESSION_PREFIX}:${req.sessionId}`);
    res.clearCookie(COOKIE_NAME);
  }
}
