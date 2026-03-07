import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

export const KineticCursor = () => {
    const [isPointer, setIsPointer] = useState(false);
    const [isHidden, setIsHidden] = useState(true);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 250, mass: 0.5 };
    const quickSpringConfig = { damping: 20, stiffness: 400, mass: 0.2 };

    const x = useSpring(mouseX, springConfig);
    const y = useSpring(mouseY, springConfig);

    const innerX = useSpring(mouseX, quickSpringConfig);
    const innerY = useSpring(mouseY, quickSpringConfig);

    const size = useSpring(isPointer ? 80 : 20, springConfig);
    const opacity = useSpring(isHidden ? 0 : 1, springConfig);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
            if (isHidden) setIsHidden(false);

            const target = e.target as HTMLElement;
            const isSelectable = window.getComputedStyle(target).cursor === 'pointer' ||
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.closest('button') ||
                target.closest('a') ||
                target.closest('.court-card');

            setIsPointer(!!isSelectable);
        };

        const handleMouseLeave = () => setIsHidden(true);
        const handleMouseEnter = () => setIsHidden(false);

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [mouseX, mouseY, isHidden]);

    return (
        <>
            {/* Outer Ring / Lens */}
            <motion.div
                className="fixed top-0 left-0 z-[9999] pointer-events-none mix-blend-difference hidden md:block"
                style={{
                    x: x,
                    y: y,
                    translateX: '-50%',
                    translateY: '-50%',
                    width: size,
                    height: size,
                    opacity: opacity,
                }}
            >
                <div className="w-full h-full border border-white rounded-full opacity-50 backdrop-invert-[0.1]" />
            </motion.div>

            {/* Inner Dot */}
            <motion.div
                className="fixed top-0 left-0 z-[9999] pointer-events-none bg-white rounded-full hidden md:block"
                style={{
                    x: innerX,
                    y: innerY,
                    translateX: '-50%',
                    translateY: '-50%',
                    width: 4,
                    height: 4,
                    opacity: opacity,
                }}
            />
        </>
    );
};
