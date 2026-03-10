import { NextResponse, type NextRequest } from "next/server";
import auth from "./app/lib/proxy/auth";
import headlessBrowserCheck from "./app/lib/proxy/headless-browser-check";
import RateLimiter from "./app/lib/proxy/rate-limiter";

const env = process.env.NODE_ENV;

export async function proxy(req: NextRequest) {
  const headlessResponse = headlessBrowserCheck(req);
  if (headlessResponse) return headlessResponse;

  if (env === "production") {
    const rateLimiter = RateLimiter(req);
    if (rateLimiter) return rateLimiter;
  }

  const authResponse = await auth(req);
  if (authResponse) return authResponse;

  return NextResponse.next({
    request: { headers: req.headers },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
