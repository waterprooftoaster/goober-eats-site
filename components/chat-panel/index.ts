/**
 * @file index.ts
 * @description Barrel export for the chat-panel module (provider, panel, context hook).
 *   Called by: app/layout.tsx, app/current-orders/current-orders-list.tsx, app/swiper/orders/pending-orders-list.tsx
 */

export { ChatPanelProvider } from './chat-panel-provider'
export { ChatPanel } from './chat-panel'
export { useChatPanel } from './chat-panel-context'
