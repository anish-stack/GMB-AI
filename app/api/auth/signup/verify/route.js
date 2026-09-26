import { signupRoute } from "@/lib/saas/publicRoute.js";
import { verifySignupEmail } from "@/lib/saas/signup.js";
import { loginUserById } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = signupRoute("signup-verify", { max: 20, windowSec: 900 }, async ({ body }) => {
  const result = await verifySignupEmail(body.token, body.code);
  if (result.next === "done") {
    await loginUserById(result.userId);
    return { next: "done", redirect: "/dashboard?welcome=1", trialDays: result.trialDays, payLater: result.payLater };
  }
  return result;
});
