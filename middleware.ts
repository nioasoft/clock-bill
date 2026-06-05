import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except API, Next internals, static files, SW, manifest.
  matcher: ["/((?!api|_next|_vercel|monitoring|sw\\.js|manifest\\.webmanifest|.*\\..*).*)"],
};
