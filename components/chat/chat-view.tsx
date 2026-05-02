'use client'

/**
 * @file chat-view.tsx
 * @description Order chat UI with Realtime message subscription, status pseudo-messages, and completion UI.
 *   ChatViewCore is a hook-free rendering core shared by ChatView (public API).
 *   Called by: components/chat-panel/chat-panel.tsx, app/current-orders/current-orders-list.tsx
 * @dependencies hooks/use-messages.ts, components/chat/chat-thread.tsx, components/chat/chat-input.tsx
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMessages, type OptimisticMessage } from '@/hooks/use-messages'
import { ChatThread } from '@/components/chat/chat-thread'
import { ChatInput } from '@/components/chat/chat-input'
import { CompletionBanner } from '@/components/chat/completion-banner'
import { OrdererCancelBanner } from '@/components/chat/orderer-cancel-banner'
import { OrderCompletedView } from '@/components/chat/order-completion-notice'
import CartScreenshotLightbox from '@/components/chat/cart-screenshot-lightbox'
import type { Conversation } from '@/lib/types/messaging'
import type { OrderStatus } from '@/lib/types/database'

export interface PseudoMessage {
    text: string
    testid?: string
    action?: { label: string; onClick: () => void }
}

interface CoreProps {
    orderId: string
    eateryName: string
    cartScreenshotUrl: string | null
    messages: OptimisticMessage[]
    conversation: Conversation | null
    currentUserId: string | null
    orderStatus: OrderStatus
    isLoading: boolean
    error: string | null
    sendMessage: (body: string) => Promise<void>
    onRetry?: (temp_id: string, body: string) => void
    onStatusChange?: (status: OrderStatus) => void
}

/**
 * Hook-free rendering core for the chat UI; handles all visual states (loading, error, completed, active).
 * @param orderId - UUID of the order this chat belongs to
 * @param eateryName - Eatery name used in the status pseudo-message
 * @param messages - Live message array from the Realtime subscription
 * @param conversation - Conversation row (null while the order is still open)
 * @param currentUserId - Authenticated user ID, or null for guests
 * @param orderStatus - Current order status used to determine which UI to show
 * @param isLoading - Whether the initial message fetch is in flight
 * @param error - Error message to display if the fetch failed
 * @param sendMessage - Async function to send a text message
 * @param onStatusChange - Optional callback invoked when the swiper changes the order status
 * @called-by ChatView
 */
function ChatViewCore({
    orderId,
    eateryName,
    cartScreenshotUrl,
    messages,
    conversation,
    currentUserId,
    orderStatus,
    isLoading,
    error,
    sendMessage,
    onRetry,
    onStatusChange,
}: CoreProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const openLightbox = useCallback(() => setLightboxOpen(true), [])
    const closeLightbox = useCallback(() => setLightboxOpen(false), [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    if (isLoading) {
        return (
            <div data-testid="chat-view" className="flex flex-1 items-center justify-center py-16">
                <div
                    aria-label="Loading messages"
                    role="status"
                    className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground motion-reduce:animate-none"
                />
            </div>
        )
    }

    if (error) {
        return (
            <div data-testid="chat-view" className="flex flex-1 items-center justify-center py-16">
                <p role="alert" className="text-sm text-destructive">{error}</p>
            </div>
        )
    }

    if (orderStatus === 'completed') {
        const completionPhoto =
            [...messages].reverse().find((m) => m.message_type === 'completion_photo') ?? null
        const isSwiper = currentUserId !== null && currentUserId === conversation?.swiper_id
        return (
            <OrderCompletedView
                viewerRole={isSwiper ? 'swiper' : 'orderer'}
                deliveryPhoto={completionPhoto}
            />
        )
    }

    const statusMessages = getStatusMessages(
        orderStatus,
        orderId,
        eateryName,
        conversation,
        currentUserId,
        cartScreenshotUrl,
        openLightbox
    )
    // Per CLAUDE.md spec: chat bubbles render text messages only; completion_photo
    // is surfaced exclusively through OrderCompletedView (above) and is never an
    // inline bubble in the thread.
    const visibleMessages = filterMessagesForViewer(messages, conversation, currentUserId)
        .filter((m) => m.message_type !== 'completion_photo')

    return (
        <div data-testid="chat-view" className="flex h-full flex-col">
            <ChatThread
                pseudoMessages={statusMessages}
                messages={visibleMessages}
                currentUserId={currentUserId}
                messagesEndRef={messagesEndRef}
                onRetry={onRetry}
            />
            {currentUserId !== null &&
                currentUserId === conversation?.swiper_id &&
                orderStatus === 'in_progress' && (
                    <CompletionBanner orderId={orderId} onStatusChange={onStatusChange} />
                )}
            {currentUserId !== null &&
                orderStatus === 'open' &&
                (conversation === null || currentUserId !== conversation.swiper_id) && (
                    <OrdererCancelBanner orderId={orderId} onStatusChange={onStatusChange} />
                )}
            <ChatInput
                onSend={sendMessage}
                disabled={orderStatus !== 'in_progress'}
                disabledPlaceholder="Waiting on a swiper. Hang Tight!"
            />
            {cartScreenshotUrl && (
                <CartScreenshotLightbox
                    open={lightboxOpen}
                    onClose={closeLightbox}
                    url={cartScreenshotUrl}
                />
            )}
        </div>
    )
}

interface Props {
    orderId: string
    eateryName: string
    /**
     * First cart screenshot URL on the order, used to power the swiper-side
     * "View cart screenshot" lightbox. Null when no screenshot is available
     * (legacy orders, data integrity fallback).
     */
    cartScreenshotUrl: string | null
    currentUserId: string | null
    orderStatus: OrderStatus
    /**
     * Pre-resolved conversation_id supplied by the chat-panel-provider's
     * loadActiveOrders LEFT JOIN (B2 pairing). When provided, useMessages skips
     * its own conversations lookup. Null when no conversation exists yet
     * (status='open' before swiper accepts).
     */
    conversationId?: string | null
    onStatusChange?: (status: OrderStatus) => void
}

/**
 * Subscribes to Realtime messages for the order and delegates rendering to ChatViewCore.
 * @param orderId - UUID of the order
 * @param eateryName - Eatery name for the status pseudo-message
 * @param currentUserId - Authenticated user ID, or null for guests
 * @param orderStatus - Current order status
 * @param conversationId - Pre-resolved conversation id from chat-panel-provider (B2 pairing)
 * @param onStatusChange - Optional callback when the swiper transitions the order status
 * @called-by components/chat-panel/chat-panel.tsx, app/current-orders/current-orders-list.tsx
 */
export function ChatView({ orderId, eateryName, cartScreenshotUrl, currentUserId, orderStatus, conversationId, onStatusChange }: Props) {
    const { messages, conversation, isLoading, error, sendMessage, appendOptimistic, markFailed, markPending, refetch } =
        useMessages({ orderId, conversationId })

    // Force a refetch on lifecycle-edge transitions so the cached `conversation`
    // row reflects the new swiper_id / swiper_full_name / swiper_assigned_at.
    // - completed: orderer needs the completion photo (status UPDATE can race
    //   ahead of the message INSERT, or the panel was minimized when it landed).
    // - in_progress: covers the re-accept case where conversations.swiper_id was
    //   null'd by a prior un-accept and is now refilled — without this refetch
    //   the orderer keeps the stale conversation and the "Swiper [name] is
    //   preparing your order!" pseudo-message can't render with the new name.
    const lastSeenStatusRef = useRef<OrderStatus | null>(null)
    useEffect(() => {
        if (orderStatus === 'completed' && lastSeenStatusRef.current !== 'completed') {
            void refetch()
        }
        if (orderStatus === 'in_progress' && lastSeenStatusRef.current !== 'in_progress') {
            void refetch()
        }
        lastSeenStatusRef.current = orderStatus
    }, [orderStatus, refetch])

    // Wrap sendMessage in the C2 optimistic flow: generate a temp_id, append the
    // optimistic entry, fire the POST. Realtime / POST response will dedupe by
    // temp_id and clear the pending status. On failure, mark failed (renders the
    // retry affordance in chat-thread).
    const handleSend = useCallback(
        async (body: string) => {
            // crypto.randomUUID is available in every browser the app supports (Safari
            // 15.4+, Chrome 92+, Firefox 95+) and in every Node runtime Next.js 16
            // targets. No fallback — a non-UUID temp_id would fail the API's
            // sendMessageSchema (z.string().uuid().optional()) and silently break the
            // optimistic flow.
            const temp_id = crypto.randomUUID()
            appendOptimistic(temp_id, body, currentUserId)
            try {
                await sendMessage(body, temp_id)
            } catch (e) {
                markFailed(temp_id)
                throw e
            }
        },
        [appendOptimistic, sendMessage, markFailed, currentUserId]
    )

    const handleRetry = useCallback(
        (temp_id: string, body: string) => {
            markPending(temp_id)
            void sendMessage(body, temp_id).catch(() => markFailed(temp_id))
        },
        [markPending, sendMessage, markFailed]
    )

    return (
        <ChatViewCore
            orderId={orderId}
            eateryName={eateryName}
            cartScreenshotUrl={cartScreenshotUrl}
            messages={messages}
            conversation={conversation}
            currentUserId={currentUserId}
            orderStatus={orderStatus}
            isLoading={isLoading}
            error={error}
            sendMessage={handleSend}
            onRetry={handleRetry}
            onStatusChange={onStatusChange}
        />
    )
}

// --- Helpers ---

/**
 * Hides messages older than the swiper's current assignment from the swiper's
 * view. Each accept (initial or re-accept) bumps conversations.swiper_assigned_at
 * to NOW(); messages with sent_at < that timestamp belong to a previous swiper
 * and should not leak into the new swiper's thread. Orderers always see the full
 * history (passing through unchanged).
 * @param messages - All messages from the conversation
 * @param conversation - Current conversation row (carries swiper_id + swiper_assigned_at)
 * @param currentUserId - Authenticated user ID (null for guests; guests are never the swiper)
 * @returns Filtered list visible to the current viewer
 * @called-by ChatViewCore
 */
function filterMessagesForViewer(
    messages: OptimisticMessage[],
    conversation: Conversation | null,
    currentUserId: string | null
): OptimisticMessage[] {
    const isSwiper = currentUserId !== null && currentUserId === conversation?.swiper_id
    if (!isSwiper) return messages
    const cutoff = conversation?.swiper_assigned_at
    if (!cutoff) return messages
    return messages.filter((m) => m.sent_at >= cutoff)
}

/**
 * Returns the ordered list of pinned status pseudo-message texts for the given role + state.
 * Orderers in in_progress see both the placed-order and preparing messages stacked.
 * Swipers in in_progress see three messages: accepted confirmation, a view-cart bubble
 * with a button that opens the cart-screenshot lightbox, and completion instructions.
 * @param orderStatus - Current order status
 * @param orderId - Full order UUID (sliced to 8 chars for display)
 * @param eateryName - Name of the eatery for the order
 * @param conversation - Current conversation row, or null if order is open
 * @param currentUserId - Authenticated user ID, or null for guests
 * @param cartScreenshotUrl - First cart screenshot URL (drives the swiper view-cart action)
 * @param onViewCartScreenshot - Click handler that opens the lightbox
 * @called-by ChatViewCore
 */
function getStatusMessages(
    orderStatus: OrderStatus,
    orderId: string,
    eateryName: string,
    conversation: Conversation | null,
    currentUserId: string | null,
    cartScreenshotUrl: string | null,
    onViewCartScreenshot: () => void
): PseudoMessage[] {
    const shortId = orderId.slice(0, 8)
    // conversation is null in 'open' state, so swiper_id check resolves to false
    const isSwiper = currentUserId !== null && currentUserId === conversation?.swiper_id
    const placedMsg: PseudoMessage = {
        text: `You've successfully placed order #${shortId} at ${eateryName}! Hold tight while a swiper accepts your order.`,
        testid: 'chat-pseudo-placed-order',
    }

    if (orderStatus === 'open' && !isSwiper) {
        // Un-accept signal: the conversation row exists (created on prior accept)
        // but its swiper_id has been cleared, so the order is back in the open
        // queue without anyone assigned. Pinned above the placed-order message
        // so the orderer sees the most recent lifecycle event first.
        if (conversation && conversation.swiper_id === null) {
            return [
                {
                    text: 'Swiper is no longer available. Finding you another swiper.',
                    testid: 'chat-pseudo-swiper-unavailable',
                },
                placedMsg,
            ]
        }
        return [placedMsg]
    }
    if (orderStatus === 'in_progress' && !isSwiper) {
        const name = conversation?.swiper_full_name ?? 'Your swiper'
        return [
            placedMsg,
            { text: `Swiper ${name} is preparing your order!`, testid: 'chat-pseudo-in-progress' },
        ]
    }
    if (orderStatus === 'in_progress' && isSwiper) {
        return [
            {
                text: `You've accepted order #${shortId} at ${eateryName}! Place the order as detailed in the screenshot.`,
                testid: 'chat-pseudo-accepted',
            },
            {
                text: 'Click here to see the order again:',
                testid: 'chat-pseudo-view-cart',
                action: cartScreenshotUrl
                    ? { label: 'View cart screenshot', onClick: onViewCartScreenshot }
                    : undefined,
            },
            {
                text: `Complete the order by uploading a screenshot of the 'Order placed' confirmation page on GrubHub. Be sure to let the orderer know what name to pick up under!`,
                testid: 'chat-pseudo-instructions',
            },
        ]
    }
    return []
}
