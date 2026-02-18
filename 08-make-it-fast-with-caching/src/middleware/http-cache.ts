// HTTP caching middleware — Cache-Control headers and ETag support

import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

interface HttpCacheOptions {
  maxAge?: number; // seconds
  sMaxAge?: number; // shared cache (CDN) max-age
  staleWhileRevalidate?: number;
  isPrivate?: boolean;
}

/**
 * Middleware that sets Cache-Control headers on responses.
 */
export function httpCache(options: HttpCacheOptions = {}) {
  const {
    maxAge = 0,
    sMaxAge,
    staleWhileRevalidate,
    isPrivate = false,
  } = options;

  return (_req: Request, res: Response, next: NextFunction): void => {
    const directives: string[] = [];

    directives.push(isPrivate ? "private" : "public");
    directives.push(`max-age=${maxAge}`);

    if (sMaxAge !== undefined) {
      directives.push(`s-maxage=${sMaxAge}`);
    }
    if (staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    res.set("Cache-Control", directives.join(", "));
    next();
  };
}

/**
 * Middleware that adds ETag support. Computes an ETag from the
 * response body and handles If-None-Match for 304 responses.
 */
export function etag() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      const bodyStr = JSON.stringify(body);
      const hash = createHash("md5").update(bodyStr).digest("hex");
      const etagValue = `"${hash}"`;

      res.set("ETag", etagValue);

      const ifNoneMatch = _req.headers["if-none-match"];
      if (ifNoneMatch === etagValue) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    };

    next();
  };
}
