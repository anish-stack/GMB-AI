import { signupRoute } from "@/lib/saas/publicRoute.js";
import { completeSignupPayment } from "@/lib/saas/signup.js";
import { loginUserById } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = signupRoute("signup-complete", { max: 10, windowSec: 900 }, async ({ body }) => {
  const result = await completeSignupPayment(body.token, body);
  if (result.userId) await loginUserById(result.userId);
  return { next: "done", redirect: "/dashboard?welcome=1" };
});
