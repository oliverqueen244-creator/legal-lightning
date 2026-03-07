import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { GripVertical, Maximize2, Minimize2, X } from 'lucide-react';

interface SovereignWidgetProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    icon?: React.ReactNode;
    onClose?: () => void;
    isDraggable?: boolean;
}

export function SovereignWidget({
    title,
    children,
    className,
    icon,
    onClose,
    isDraggable = true
}: SovereignWidgetProps) {
    return (
        <motion.div
            layout
            className={cn(
                "group relative flex flex-col glass-card border-border/40 hover:border-primary/30 transition-colors overflow-hidden",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
                className
            )}
        >
            {/* Widget Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-2">
                    {isDraggable && (
                        <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
                    )}
                    {icon && <div className="text-primary">{icon}</div>}
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                        {title}
                    </h3>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-white/10 rounded text-muted-foreground">
                        <Minimize2 className="h-3 w-3" />
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-destructive/20 hover:text-destructive rounded text-muted-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Widget Content */}
            <div className="flex-1 p-4 relative z-10">
                {children}
            </div>

            {/* Industrial Accents */}
            <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10px] right-[-10px] w-20 h-1 bg-primary/20 rotate-45" />
            </div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-primary/40 pointer-events-none" />
        </motion.div>
    );
}
