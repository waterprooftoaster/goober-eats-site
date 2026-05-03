/**
 * @file stateful-button.tsx
 * @description Animated button that shows a spinner while its async onClick
 *   resolves, then optionally plays a check-mark animation (showFinishState=true)
 *   or leaves the spinner running until the page navigates away (showFinishState=false).
 *   Called by: app/swiper-registration/swiper-registration-form.tsx,
 *              components/home-upload.tsx
 * @dependencies motion/react
 */

"use client";
import { cn } from "@/lib/utils";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type ButtonState = "idle" | "loading" | "success";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string;
    children: React.ReactNode;
    /** When false, skip the success animation and leave the spinner running. */
    showFinishState?: boolean;
    /** CSS color for the button background. Defaults to brand lime green. */
    bgColor?: string;
    /** CSS color for the focus/hover ring. Defaults to brand near-black. */
    ringColor?: string;
    /** CSS color for text and icons. Defaults to brand near-black (high contrast on lime). */
    contentColor?: string;
}

/**
 * Button that animates a loading spinner during its async onClick, then
 * optionally shows a check-mark before resetting.
 * @param showFinishState - true (default) plays the check animation; false leaves the spinner spinning (use when the page will redirect).
 * @param bgColor - CSS color for the button background; defaults to forest green oklch(0.49 0.17 126) — clears WCAG AA against white (~5.2:1).
 * @param ringColor - CSS color for the hover/focus ring; defaults to brand lime oklch(0.77 0.17 126) — complements the darker forest green background.
 * @param contentColor - CSS color for text and icons; defaults to warm off-white oklch(0.985 0.007 126) for WCAG AA contrast on the forest green background.
 * @called-by app/swiper-registration/swiper-registration-form.tsx, components/home-upload.tsx
 */
export const StatefulButton = ({
    className,
    children,
    showFinishState = true,
    bgColor = "oklch(0.49 0.17 126)",
    ringColor = "oklch(0.77 0.17 126)",
    contentColor = "oklch(0.985 0.007 126)",
    ...props
}: ButtonProps) => {
    const [buttonState, setButtonState] = useState<ButtonState>("idle");

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (buttonState !== "idle") return;
        setButtonState("loading");
        await props.onClick?.(event);
        if (showFinishState) {
            setButtonState("success");
            await new Promise((r) => setTimeout(r, 1800));
            setButtonState("idle");
        }
    };

    const {
        onClick,
        onDrag,
        onDragStart,
        onDragEnd,
        onAnimationStart,
        onAnimationEnd,
        style,
        disabled,
        ...buttonProps
    } = props;

    const isIdle = buttonState === "idle";

    return (
        <motion.button
            layout
            className={cn(
                "relative flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-sm px-5 py-3 text-base font-bold tracking-tight outline-none",
                "transition-opacity duration-150",
                "disabled:cursor-not-allowed disabled:opacity-40",
                className,
            )}
            style={{ backgroundColor: bgColor, color: contentColor, ...style }}
            disabled={!isIdle || disabled}
            whileHover={isIdle ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}}
            whileTap={isIdle ? { scale: 0.97 } : {}}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            {...buttonProps}
            onClick={handleClick}
        >
            <motion.div layout className="flex items-center gap-2">
                <AnimatePresence mode="popLayout">
                    {buttonState === "loading" && (
                        <motion.span
                            key="spinner"
                            className="flex items-center"
                            initial={{ opacity: 0, scale: 0.5, width: 0 }}
                            animate={{ opacity: 1, scale: 1, width: 16 }}
                            exit={{ opacity: 0, scale: 0.5, width: 0 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <Spinner />
                        </motion.span>
                    )}
                    {buttonState === "success" && (
                        <motion.span
                            key="check"
                            className="flex items-center"
                            initial={{ opacity: 0, scale: 0.5, width: 0 }}
                            animate={{ opacity: 1, scale: 1, width: 16 }}
                            exit={{ opacity: 0, scale: 0.5, width: 0 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <CheckIcon />
                        </motion.span>
                    )}
                </AnimatePresence>
                <motion.span layout>{children}</motion.span>
            </motion.div>
        </motion.button>
    );
};

// --- Helpers ---

const Spinner = () => (
    <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="#ffffff"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    >
        <path d="M12 3a9 9 0 1 0 9 9" />
    </motion.svg>
);

const CheckIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);
