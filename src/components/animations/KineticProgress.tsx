import React from 'react';
import { motion, useScroll, useSpring, useVelocity, useTransform } from 'framer-motion';

export const KineticProgress = () => {
    const { scrollYProgress } = useScroll();
    const velocity = useVelocity(scrollYProgress);

    const width = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const skewX = useTransform(velocity, [-1, 1], [-20, 20]);
    const scaleY = useTransform(velocity, [-1, 0, 1], [1.5, 1, 1.5]);
    const opacity = useTransform(velocity, [-0.1, 0, 0.1], [0.8, 0.4, 0.8]);

    return (
        <div className="fixed top-0 left-0 right-0 h-1.5 z-[100] origin-left pointer-events-none">
            <motion.div
                className="h-full bg-primary"
                style={{
                    scaleX: width,
                    skewX: skewX,
                    scaleY: scaleY,
                    opacity: opacity,
                }}
            />
        </div>
    );
};
