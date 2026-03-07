import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Search,
    FileText,
    Shield,
    MessageSquare,
    LayoutDashboard,
    BookOpen,
    Zap
} from 'lucide-react';
import { useMorningBrief } from '@/hooks/useMorningBrief';

export function GlobalCommandPalette() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { data: brief } = useMorningBrief();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search cases..." />
            <CommandList className="legal-scroll">
                <CommandEmpty>No results found.</CommandEmpty>

                {/* Cases Section */}
                {brief && brief.cases.length > 0 && (
                    <CommandGroup heading="Today's Cases">
                        {brief.cases.map((caseItem) => (
                            <CommandItem
                                key={caseItem.id}
                                onSelect={() => runCommand(() => navigate(`/war-room/${caseItem.id}`))}
                                className="gap-2"
                            >
                                <div className="bg-primary/10 p-1.5 rounded">
                                    <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <span>#{caseItem.item_no} - {caseItem.case_number}</span>
                                <span className="text-xs text-muted-foreground ml-2 truncate">
                                    {caseItem.petitioner} vs {caseItem.respondent}
                                </span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                <CommandSeparator />

                {/* Navigation Section */}
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                        <CommandShortcut>⌘D</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/docs'))}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        <span>Documentation</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/admin'))}>
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Console</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                        <CommandShortcut>⌘S</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                {/* Actions Section */}
                <CommandGroup heading="Quick Actions">
                    <CommandItem onSelect={() => runCommand(() => {
                        // Trigger New Whisper logic - assuming it would be done via a global state or simple navigation
                        navigate('/');
                        // Potentially scroll to whisper or open drawer
                    })}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>New Whisper</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/dossier'))}>
                        <Zap className="mr-2 h-4 w-4 text-amber-500" />
                        <span>Product Dossier</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
