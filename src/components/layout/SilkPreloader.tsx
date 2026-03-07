import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoImage from '@/assets/logo.png';

export const SilkPreloader = () => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{
                        y: '-100%',
                        transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] }
                    }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="flex flex-col items-center gap-4"
                    >
                        <div className="relative">
                            <motion.img
                                src={logoImage}
                                alt="Nyay-Hub"
                                className="h-20 w-20 relative z-10"
                                animate={{
                                    filter: ['blur(0px)', 'blur(2px)', 'blur(0px)'],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <motion.div
                                className="absolute inset-0 bg-primary/20 blur-xl rounded-full"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                        <div className="overflow-hidden">
                            <motion.h2
                                initial={{ y: 40 }}
                                animate={{ y: 0 }}
                                transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
                                className="font-display text-2xl font-bold tracking-tighter"
                            >
                                NYAY-HUB
                            </motion.h2>
                        </div>
                        <motion.div
                            className="h-[1px] bg-primary/30 w-40 mt-2 relative overflow-hidden"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.3, duration: 1.2, ease: 'easeInOut' }}
                        >
                            <motion.div
                                className="absolute inset-0 bg-primary"
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            />
                        </motion.div>
                    </motion.div>

                    <div className="absolute bottom-12 flex flex-col items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground opacity-50">
                            Initializing Kinetic Engine
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
