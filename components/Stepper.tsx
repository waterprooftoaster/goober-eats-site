import { AnimatePresence, motion, Variants } from 'motion/react';
import React, { HTMLAttributes, JSX, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import './Stepper.css';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  currentStep: 1 | 2 | 3;
  children: [ReactNode, ReactNode, ReactNode];
  stepIcons?: [ReactNode, ReactNode, ReactNode];
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
}

export default function Stepper({
  currentStep,
  children,
  stepIcons,
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  ...rest
}: StepperProps) {
  const totalSteps = 3;
  const prevStepRef = useRef<number>(currentStep);
  // Reading prevStepRef during render is intentional — direction is purely
  // visual (slide animation) and the ref is updated synchronously below.
  // eslint-disable-next-line react-hooks/refs
  const direction = currentStep >= prevStepRef.current ? 1 : -1;

  useEffect(() => {
    prevStepRef.current = currentStep;
  }, [currentStep]);

  return (
    <div className="outer-container" {...rest}>
      <div className={`step-circle-container ${stepCircleContainerClassName}`}>
        <div className={`step-indicator-row ${stepContainerClassName}`}>
          {([1, 2, 3] as const).map((stepNumber) => {
            const isNotLastStep = stepNumber < totalSteps;
            return (
              <React.Fragment key={stepNumber}>
                <StepIndicator step={stepNumber} currentStep={currentStep} icon={stepIcons?.[stepNumber - 1]} />
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          currentStep={currentStep}
          direction={direction}
          className={`step-content-default ${contentClassName}`}
        >
          {children[currentStep - 1]}
        </StepContentWrapper>
      </div>
    </div>
  );
}

// --- Helpers ---

interface StepContentWrapperProps {
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({ currentStep, direction, children, className }: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        <SlideTransition key={currentStep} direction={direction} onHeightReady={h => setParentHeight(h)}>
          {children}
        </SlideTransition>
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (h: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? '-100%' : '100%',
    opacity: 0
  }),
  center: {
    x: '0%',
    opacity: 1
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? '50%' : '-50%',
    opacity: 0
  })
};

interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps): JSX.Element {
  return <div className="step-default">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  icon?: ReactNode;
}

function StepIndicator({ step, currentStep, icon }: StepIndicatorProps) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  return (
    <motion.div className="step-indicator" style={{ pointerEvents: 'none' }} animate={status} initial={false}>
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: '#e5e5e5', color: '#ffffff' },
          active: { scale: 1, backgroundColor: '#000000', color: '#ffffff' },
          complete: { scale: 1, backgroundColor: '#000000', color: '#ffffff' }
        }}
        transition={{ duration: 0.3 }}
        className="step-indicator-inner"
      >
        {icon ?? <span className="step-number text-xl font-medium">{step}</span>}
      </motion.div>
    </motion.div>
  );
}

interface StepConnectorProps {
  isComplete: boolean;
}

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    incomplete: { width: 0, backgroundColor: 'rgba(0, 0, 0, 0)' },
    complete: { width: '100%', backgroundColor: '#000000' }
  };

  return (
    <div className="step-connector">
      <motion.div
        className="step-connector-inner"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

