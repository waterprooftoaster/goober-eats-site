/**
 * @file index.ts
 * @description Barrel export for the chat-panel module (provider + context hook).
 *   The legacy ChatPanel popup was removed in favor of the universal
 *   components/bottom-dock.tsx (redirect to /current-orders).
 *   Called by: app/layout.tsx, app/current-orders/current-orders-list.tsx,
 *   app/swiper/orders/pending-orders-list.tsx, app/order/[orderId]/guest-panel-opener.tsx,
 *   components/bottom-dock.tsx
 */

export { ChatPanelProvider } from './chat-panel-provider'
export { useChatPanel } from './chat-panel-context'
