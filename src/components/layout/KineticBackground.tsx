import React from 'react';
import { motion } from 'framer-motion';

export const KineticBackground = () => {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none opacity-30">
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 90, 180, 270, 360],
                    x: ['-10%', '10%', '-10%'],
                    y: ['-10%', '10%', '-10%'],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.08)_0%,transparent_70%)]"
            />
            <motion.div
                animate={{
                    scale: [1.2, 1, 1.2],
                    rotate: [360, 270, 180, 90, 0],
                    x: ['10%', '-10%', '10%'],
                    y: ['10%', '-10%', '10%'],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute -bottom-[50%] -right-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(var(--gold-rgb),0.05)_0%,transparent_70%)]"
            />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
        </div>
    );
};
