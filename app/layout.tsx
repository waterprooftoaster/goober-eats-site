/**
 * @file layout.tsx
 * @description Root layout wrapping every page with header, banner slot, modal slot, chat panel, and font variables.
 *   Called by: Next.js App Router (wraps all routes)
 * @dependencies components/header.tsx, components/chat-panel.tsx, lib/supabase/server.ts
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { bricolageGrotesque, figtree } from "./fonts";
import { Header } from "@/components/header";
import { HeaderWrapper } from "@/components/header-wrapper";
import { SwiperOrdersButton } from "@/components/swiper-orders-button";
import { ChatPanelProvider, ChatPanel } from "@/components/chat-panel";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/api/helpers";
import { resolvePrincipal } from "@/lib/auth/resolve-principal";

export const metadata: Metadata = {
  title: "Goober Eats",
  description: "Peer-to-peer student meal swipe sharing app",
};

/**
 * Renders the root HTML shell with fonts, providers, header, banner slot, and chat panel.
 * @param children - Page content
 * @param banner - Parallel route @banner slot
 * @returns Full HTML document with all layout wrappers
 * @called-by Next.js App Router
 */
export default async function RootLayout({
  children,
  banner,
}: Readonly<{
  children: React.ReactNode;
  banner: React.ReactNode;
}>) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const principal = await resolvePrincipal(supabase, cookieStore);
  const user = await getAuthenticatedUser(supabase);

  const isSwiper = user
    ? ((await supabase.from('profiles').select('is_swiper').eq('id', user.id).single())
        .data?.is_swiper ?? false)
    : false

  const pendingOrderCount = (user && isSwiper)
    ? (await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
      ).count ?? 0
    : 0

  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${figtree.variable} antialiased`}
      data-testid="root-layout"
    >
      <body>
        <ChatPanelProvider userId={user?.id ?? null}>
          <HeaderWrapper hasBanner={!isSwiper}>
            <Header principal={principal} />
          </HeaderWrapper>
          {banner}
          <div className="px-6">{children}</div>
          <SwiperOrdersButton isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
          <ChatPanel currentUserId={user?.id ?? null} />
        </ChatPanelProvider>
      </body>
    </html>
  );
}
