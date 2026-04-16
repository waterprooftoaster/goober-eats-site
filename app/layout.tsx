import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { HeaderWrapper } from "@/components/header-wrapper";
import { SwiperOrdersButton } from "@/components/swiper-orders-button";
import { ChatPanelProvider, ChatPanel } from "@/components/chat-panel";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/api/helpers";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Goober Eats",
  description: "Peer-to-peer student meal swipe sharing app",
};

export default async function RootLayout({
  children,
  modal,
  banner,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
  banner: React.ReactNode;
}>) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  const isSwiper = user
    ? ((await supabase.from('profiles').select('is_swiper').eq('id', user.id).single())
        .data?.is_swiper ?? false)
    : false

  const pendingOrderCount = (user && isSwiper)
    ? (await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      ).count ?? 0
    : 0

  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <ChatPanelProvider userId={user?.id ?? null}>
          <HeaderWrapper hasBanner={!isSwiper}>
            <Header />
          </HeaderWrapper>
          {banner}
          <div className="px-6">{children}</div>
          <SwiperOrdersButton isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
          {modal}
          <ChatPanel currentUserId={user?.id ?? null} />
        </ChatPanelProvider>
      </body>
    </html>
  );
}
