import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface BreathingTypeProps {
    children: React.ReactNode;
    className?: string;
}

export const BreathingType = ({ children, className = "" }: BreathingTypeProps) => {
    const ref = React.useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const letterSpacing = useTransform(scrollYProgress, [0, 0.5, 1], ["0.05em", "0.2em", "0.05em"]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.3, 1, 1, 0.3]);
    const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1.02, 0.95]);

    return (
        <motion.div
            ref={ref}
            style={{ letterSpacing, opacity, scale }}
            className={className}
        >
            {children}
        </motion.div>
    );
};
