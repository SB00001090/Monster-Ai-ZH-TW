import { COOKIE_NAME } from "@shared/const";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getSessionCookieOptions } from "../_core/cookies";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  logout: protectedProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true as const };
  }),
});