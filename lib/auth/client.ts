/**
 * Better Auth React client. Use in client components for sign in/up/out and
 * session access. `inferAdditionalFields` brings the server-side `role` field
 * into the typed session.
 */
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth/client";
import type { auth } from "./better-auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), polarClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
