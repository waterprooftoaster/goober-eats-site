-- Prevent authenticated users from directly setting is_swiper via the client SDK.
-- The API route (app/api/profile/route.ts) uses the service role client to perform
-- this update after validating school + Stripe prerequisites server-side.
REVOKE UPDATE (is_swiper) ON public.profiles FROM authenticated;
