import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChatPanelProvider, ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/api/helpers";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
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
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
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
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ChatPanelProvider userId={user?.id ?? null}>
          <div className="h-full flex flex-col">
            <Header />
            {!isSwiper && (
              <div className="bg-white px-6 py-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Expiring Meal Swipes? Sell them for 50% off
                </h2>
                <div className="mt-4">
                  <Button asChild>
                    <Link href={user ? '/account' : '/auth/login'}>Become a Swiper</Link>
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-1 min-h-0">
              <Sidebar user={user} isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
              <div className="flex-1 min-w-0 px-6 overflow-y-auto">
                {children}
              </div>
            </div>
          </div>
          {modal}
          <ChatPanel currentUserId={user?.id ?? null} />
        </ChatPanelProvider>
      </body>
    </html>
  );
}
