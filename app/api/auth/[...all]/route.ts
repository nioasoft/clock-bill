import { auth } from "@/lib/auth/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth catch-all handler. Serves all Better Auth endpoints under
 * /api/auth/* (sign-in, sign-up, sign-out, callback/google, get-session, ...).
 * The app's custom /api/auth/session and /api/auth/logout routes are more
 * specific and take precedence over this catch-all.
 */
export const { POST, GET } = toNextJsHandler(auth);
