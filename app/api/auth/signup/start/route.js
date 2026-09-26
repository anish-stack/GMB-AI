import { signupRoute } from "@/lib/saas/publicRoute.js";
import { startSignup } from "@/lib/saas/signup.js";

export const dynamic = "force-dynamic";

export const POST = signupRoute("signup-start", { max: 6, windowSec: 900 }, ({ body, ip }) => startSignup(body, { ip }));
