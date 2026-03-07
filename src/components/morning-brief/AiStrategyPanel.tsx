import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Target, Shield, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { AiDisclaimer } from '@/components/ui/AiDisclaimer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

interface AiStrategyPanelProps {
    caseNumber: string;
    petitioner: string | null;
    respondent: string | null;
    judgeName: string | null;
    onClose?: () => void;
}

export function AiStrategyPanel({ caseNumber, petitioner, respondent, judgeName, onClose }: AiStrategyPanelProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [strategy, setStrategy] = useState<{
        summary: string;
        points: { icon: any; title: string; content: string }[];
        conclusion: string;
    } | null>(null);

    const handleGenerate = () => {
        setIsGenerating(true);
        // Simulate AI generation
        setTimeout(() => {
            setStrategy({
                summary: `Strategic overview for ${caseNumber} (${petitioner} vs ${respondent}). The matter is listed before Hon'ble ${judgeName || 'Bench'}.`,
                points: [
                    {
                        icon: Target,
                        title: "Core Objective",
                        content: "Establish jurisdictional primacy before delving into merits. The current bench has recently emphasized procedural compliance in similar writ petitions."
                    },
                    {
                        icon: Shield,
                        title: "Defense Strategy",
                        content: "Anticipate questions regarding the delay in filing. Prepare to cite the 'Limitation vs. Substantial Justice' doctrine if pressed on laches."
                    },
                    {
                        icon: AlertTriangle,
                        title: "Critical Risks",
                        content: "Missing Rejoinder for the 3rd respondent might lead to an adjournment. Request permission to file it during the hearing if necessary."
                    }
                ],
                conclusion: "Recommendation: Strongly push for an interim stay today as the prima facie case is robust, but be ready for a 'Final Disposal' notice."
            });
            setIsGenerating(false);
        }, 2000);
    };

    return (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-primary/10 bg-primary/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle className="text-sm font-display tracking-wide uppercase">AI Strategy Generator</CardTitle>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-4 px-4 pb-4">
                {!strategy && !isGenerating && (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <Target className="h-8 w-8 text-primary/60" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Ready to analyze case strategy</p>
                            <p className="text-xs text-muted-foreground mt-1 px-4">AI will scan previous orders, bench history, and documents to suggest a tactical approach.</p>
                        </div>
                        <Button onClick={handleGenerate} className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Generate Strategy
                        </Button>
                    </div>
                )}

                {isGenerating && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-xs text-primary font-medium animate-pulse">Running Litigation OS Neural Engine...</p>
                    </div>
                )}

                {strategy && !isGenerating && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="text-sm text-foreground/90 leading-relaxed border-l-2 border-primary/30 pl-3">
                            {strategy.summary}
                        </div>

                        <div className="space-y-3">
                            {strategy.points.map((point, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="mt-1">
                                        <point.icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{point.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{point.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-primary/10 p-3 rounded text-xs font-semibold text-primary border border-primary/20">
                            {strategy.conclusion}
                        </div>

                        <div className="pt-2">
                            <AiDisclaimer />
                        </div>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
}
