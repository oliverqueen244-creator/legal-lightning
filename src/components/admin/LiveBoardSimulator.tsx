import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Activity, Play, SkipForward, AlertCircle, WifiOff, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import type { LiveBoardCache } from '@/types/database';

export default function LiveBoardSimulator() {
    const { data: boards } = useLiveBoard();
    const [selectedBoardKey, setSelectedBoardKey] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [intervalSecs, setIntervalSecs] = useState(10);
    const [autoIncrement, setAutoIncrement] = useState(true);

    const selectedBoard = boards?.find(b => `${b.court_location}-${b.court_no}` === selectedBoardKey);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isRunning && selectedBoardKey && autoIncrement) {
            timer = setInterval(async () => {
                const board = boards?.find(b => `${b.court_location}-${b.court_no}` === selectedBoardKey);
                if (board) {
                    await incrementItem(board);
                }
            }, intervalSecs * 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isRunning, selectedBoardKey, autoIncrement, intervalSecs, boards]);

    const incrementItem = async (board: LiveBoardCache) => {
        const nextItem = (board.current_item || 0) + 1;
        try {
            const { error } = await supabase
                .from('live_board_cache')
                .update({
                    current_item: nextItem,
                    last_updated: new Date().toISOString()
                })
                .eq('court_location', board.court_location)
                .eq('court_no', board.court_no);

            if (error) throw error;
        } catch (err) {
            console.error('Simulator Sync Error:', err);
            toast.error('Simulator Sync Error');
            setIsRunning(false);
        }
    };

    const toggleStatus = async (board: LiveBoardCache) => {
        const nextStatus = board.status === 'hearing' ? 'lunch' : 'hearing';
        try {
            await supabase
                .from('live_board_cache')
                .update({
                    status: nextStatus,
                    last_updated: new Date().toISOString()
                })
                .eq('court_location', board.court_location)
                .eq('court_no', board.court_no);
        } catch (err) {
            toast.error('Sync Error');
        }
    };

    return (
        <Card className="border-primary/20 bg-black/40 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />

            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <CardTitle className="text-sm font-bold tracking-widest uppercase">Live Board Simulator</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                        <Zap className="h-3 w-3 mr-1" />
                        Beta Dev
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Court</p>
                        <div className="grid grid-cols-1 gap-2">
                            {boards?.map(board => {
                                const key = `${board.court_location}-${board.court_no}`;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedBoardKey(key)}
                                        className={`text-left p-3 rounded-lg border transition-all ${selectedBoardKey === key
                                            ? 'bg-primary/10 border-primary shadow-[0_0_10px_rgba(251,191,36,0.1)] text-primary'
                                            : 'bg-white/5 border-border/20 text-muted-foreground hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="text-xs font-bold uppercase">Court {board.court_no}</div>
                                        <div className="text-[10px] opacity-60">{board.court_location}</div>
                                        <div className="mt-2 text-xl font-display font-bold tabular-nums">
                                            #{board.current_item || 0}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {selectedBoard ? (
                            <>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Controls</p>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={isRunning}
                                                onCheckedChange={setIsRunning}
                                            />
                                            <span className="text-xs">{isRunning ? 'Running' : 'Paused'}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => incrementItem(selectedBoard)}
                                        >
                                            <SkipForward className="h-4 w-4 mr-1" />
                                            Next Item
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => toggleStatus(selectedBoard)}
                                        >
                                            {selectedBoard.status === 'hearing' ? 'Set Lunch' : 'Set Hearing'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                                        <span>Interval: {intervalSecs}s</span>
                                    </div>
                                    <Slider
                                        value={[intervalSecs]}
                                        min={2}
                                        max={60}
                                        step={1}
                                        onValueChange={(v) => setIntervalSecs(v[0])}
                                    />
                                </div>

                                <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                                    <p className="text-[10px] text-yellow-500/80 leading-relaxed">
                                        Simulation triggers real-time updates for ALL connected users.
                                        Do not use on production boards without explicit synchronization.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/40 rounded-lg">
                                <Activity className="h-8 w-8 text-muted-foreground/20 mb-3" />
                                <p className="text-xs text-muted-foreground italic">Select a board to begin simulation</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
