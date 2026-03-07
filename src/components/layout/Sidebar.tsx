import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDensity } from '@/contexts/DensityContext';
import {
    LayoutDashboard,
    FileText,
    Shield,
    BookOpen,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    LogOut,
    User,
    Minimize2,
    Maximize2,
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import logoImage from '@/assets/logo.png';

interface SidebarItemProps {
    icon: any;
    label: string;
    href: string;
    isActive: boolean;
    isCollapsed: boolean;
    onClick: () => void;
    badge?: string | number;
}

function SidebarItem({ icon: Icon, label, href, isActive, isCollapsed, onClick, badge }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative flex items-center w-full gap-3 px-3 py-2.5 rounded-lg transition-all group",
                isActive
                    ? "bg-primary/10 text-primary border-r-2 border-primary shadow-[0_0_15px_rgba(251,191,36,0.1)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border-r-2 border-transparent"

            )}
        >
            <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : "group-hover:scale-110 transition-transform")} />

            {!isCollapsed && (
                <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm font-medium whitespace-nowrap"
                >
                    {label}
                </motion.span>
            )}

            {badge && !isCollapsed && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {badge}
                </span>
            )}


        </button>
    );
}

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { profile, signOut } = useAuth();
    const { density, setDensity } = useDensity();
    const navigate = useNavigate();
    const location = useLocation();


    const navigation = [
        { icon: LayoutDashboard, label: 'Docket', href: '/' },
        { icon: Zap, label: 'Technical Dossier', href: '/dossier' },
        { icon: Shield, label: 'Admin Console', href: '/admin' },
        { icon: BookOpen, label: 'Documentation', href: '/docs' },
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 260 }}
            className={cn(
                "fixed left-0 top-0 h-screen z-50 flex flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300",
                "hidden md:flex" // Hide on mobile, we'll use a bottom bar or menu for mobile later
            )}
        >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div
                    className="flex items-center gap-3 cursor-pointer overflow-hidden"
                    onClick={() => navigate('/')}
                >
                    <img src={logoImage} alt="Logo" className="h-8 w-8 shrink-0" />
                    <AnimatePresence>
                        {!isCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="flex flex-col"
                            >
                                <span className="font-display font-bold text-lg tracking-tight leading-none">Nyay-Hub</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Sovereign OS</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-20 bg-card border border-border rounded-full p-1 hover:bg-primary hover:text-primary-foreground transition-colors shadow-xl z-50"
            >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-2">
                {navigation.map((item) => (
                    <SidebarItem
                        key={item.href}
                        {...item}
                        isActive={location.pathname === item.href}
                        isCollapsed={isCollapsed}
                        onClick={() => navigate(item.href)}
                    />
                ))}

                <div className="pt-4 mt-4 border-t border-border/50">
                    {!isCollapsed && <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-3">Case Context</p>}
                    <SidebarItem
                        icon={MessageSquare}
                        label="Quick Whisper"
                        href="#"
                        isActive={false}
                        isCollapsed={isCollapsed}
                        onClick={() => { }}
                    />
                </div>
            </nav>

            {/* Footer / Profile */}
            <div className="p-4 border-t border-border/50 bg-black/10 space-y-4">
                {/* Density Toggle */}
                {!isCollapsed && (
                    <div className="flex items-center justify-between px-2 bg-white/5 rounded-lg py-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Density</span>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-6 w-6", density === 'normal' && "bg-primary text-primary-foreground")}
                                onClick={() => setDensity('normal')}
                            >
                                <Maximize2 className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-6 w-6", density === 'compact' && "bg-primary text-primary-foreground")}
                                onClick={() => setDensity('compact')}
                            >
                                <Minimize2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                )}

                <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
                    <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{profile?.role || 'Advocate'}</p>
                        </div>
                    )}
                    {!isCollapsed && (
                        <button
                            onClick={() => signOut()}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

        </motion.aside>
    );
}
