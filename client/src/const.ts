export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Default Monster AI brand mark (served from client/public). */
export const APP_LOGO_SRC = import.meta.env.VITE_APP_LOGO || "/monster-logo.png";

export const isOAuthConfigured = () =>
  Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL?.trim());

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  if (!oauthPortalUrl) {
    return import.meta.env.DEV ? "/api/oauth/dev-login" : "/login";
  }

  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
