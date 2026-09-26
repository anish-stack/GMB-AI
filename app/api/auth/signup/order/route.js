import { signupRoute } from "@/lib/saas/publicRoute.js";
import { createSignupOrder } from "@/lib/saas/signup.js";

export const dynamic = "force-dynamic";

export const POST = signupRoute("signup-order", { max: 10, windowSec: 900 }, ({ body }) => createSignupOrder(body.token));
