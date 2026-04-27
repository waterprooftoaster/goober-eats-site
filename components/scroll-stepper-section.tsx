/**
 * @file scroll-stepper-section.tsx
 * @description Scroll-pinned stepper section. Uses CSS position:sticky to pin the
 *   rectangle at viewport center while the user scrolls PIN_DISTANCE_PX, advancing
 *   the steps 1→2→3 via a rAF-throttled scroll listener that maps section progress
 *   to currentStep.
 *   Called by: components/cover-page.tsx
 * @dependencies components/Stepper.tsx
 */

'use client'

import { useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Vibrate, FileUp, Hamburger } from 'lucide-react'
import Stepper, { Step } from '@/components/Stepper'
import PhoneCart from './icons/phone-cart'

const PIN_DISTANCE_PX = 1800
// Stepper's outer-container has padding-top: 1rem (Stepper.css), so the visible
// rectangle sits 16px below the sticky div's top edge. Subtract it from stickyTop
// to put the rectangle's geometric center at the viewport's center.
const OUTER_CONTAINER_PADDING_TOP_PX = 16

/**
 * Slide variants matching Stepper's internal step transitions.
 * dir >= 0 means forward (left-to-right), dir < 0 means backward.
 */
const phoneCartVariants = {
    enter: (dir: number) => ({
        x: dir >= 0 ? '-100%' : '100%',
        opacity: 0,
    }),
    center: { x: '0%', opacity: 1 },
    exit: (dir: number) => ({
        x: dir >= 0 ? '50%' : '-50%',
        opacity: 0,
    }),
}

export default function ScrollStepperSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const stickyRef = useRef<HTMLDivElement>(null)
    const stepperRef = useRef<HTMLDivElement>(null)
    const prevStepRef = useRef<number>(1)
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
    const [geom, setGeom] = useState<Geometry | null>(null)

    // Computed during render so exit animations capture the correct direction
    const direction = currentStep >= prevStepRef.current ? 1 : -1

    useEffect(() => {
        prevStepRef.current = currentStep
    }, [currentStep])

    useEffect(() => {
        if (!stepperRef.current) return
        const rectEl = stepperRef.current.querySelector<HTMLElement>('.step-circle-container')
        if (!rectEl) return
        const measure = () => {
            const rectHeight = rectEl.offsetHeight
            const vh = window.innerHeight
            // Clamp to 0 when the rectangle is taller than the viewport, otherwise
            // sticky pins above the visible area on short-viewport mobile.
            const stickyTop = Math.max(
                0,
                (vh - rectHeight) / 2 - OUTER_CONTAINER_PADDING_TOP_PX,
            )
            const sectionHeight = rectHeight + PIN_DISTANCE_PX
            setGeom({ stickyTop, sectionHeight })
        }
        measure()
        window.addEventListener('resize', measure)
        const ro = new ResizeObserver(measure)
        ro.observe(rectEl)
        return () => {
            window.removeEventListener('resize', measure)
            ro.disconnect()
        }
    }, [])

    useEffect(() => {
        if (!geom) return
        let rafId = 0
        const update = () => {
            rafId = 0
            if (!sectionRef.current) return
            const rect = sectionRef.current.getBoundingClientRect()
            const progress = Math.max(
                0,
                Math.min(1, (geom.stickyTop - rect.top) / PIN_DISTANCE_PX),
            )
            const nextStep: 1 | 2 | 3 = progress >= 0.66 ? 3 : progress >= 0.33 ? 2 : 1
            setCurrentStep((prev) => (prev === nextStep ? prev : nextStep))
        }
        const onScroll = () => {
            if (rafId === 0) rafId = requestAnimationFrame(update)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        update()
        return () => {
            window.removeEventListener('scroll', onScroll)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [geom])

    return (
        <section
            ref={sectionRef}
            className="bg-background"
            style={{ height: geom ? `${geom.sectionHeight}px` : 'auto' }}
        >
            <div
                ref={stickyRef}
                style={{
                    position: 'sticky',
                    top: geom ? `${geom.stickyTop}px` : '0px',
                }}
            >
                <div ref={stepperRef} className="w-full flex justify-center">
                    <Stepper
                        currentStep={currentStep}
                        style={{ paddingTop: 0 }}
                        stepCircleContainerClassName="bg-white"
                        stepIcons={[
                            <Vibrate key="1" size={18} color="#ffffff" />,
                            <FileUp key="2" size={18} color="#ffffff" />,
                            <Hamburger key="3" size={18} color="#ffffff" />,
                        ]}
                    >
                        <Step>
                            <p className="font-display text-2xl font-bold text-foreground">Step 1: Snap your cart</p>
                            <p className="text-xl font-medium text-muted-foreground pb-8">Take a screenshot of your GrubHub cart</p>
                        </Step>
                        <Step>
                            <p className="font-display text-2xl font-bold text-foreground">Step 2: Drop it in</p>
                            <p className="text-xl font-medium text-muted-foreground pb-8">Upload the screenshot here on Goober</p>
                        </Step>
                        <Step>
                            <p className="font-display text-2xl font-bold text-foreground">Step 3: Eat</p>
                            <p className="text-xl font-medium text-muted-foreground pb-8">A student at your school is on the way</p>
                        </Step>
                    </Stepper>
                </div>
                <AnimatePresence initial={false} mode="sync" custom={direction}>
                    {currentStep === 1 && (
                        <motion.div
                            key="phone-cart"
                            custom={direction}
                            variants={phoneCartVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.4 }}
                            className="absolute top-24 left-20 pointer-events-none z-[51]"
                        >
                            <PhoneCart
                                height={1050}
                                width={1050}
                                className="text-white"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    )
}

// --- Helpers ---

interface Geometry {
    stickyTop: number
    sectionHeight: number
}
