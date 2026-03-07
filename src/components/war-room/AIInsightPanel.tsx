import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Sparkles, Search, MessageSquare, ListChecks } from 'lucide-react';
import { useAIIntelligence } from '@/hooks/useAIIntelligence';
import { Skeleton } from '@/components/ui/skeleton';

interface AIInsightPanelProps {
    docketId: string;
    pdfUrl?: string;
}

export function AIInsightPanel({ docketId, pdfUrl }: AIInsightPanelProps) {
    const { isSummarizing, summary, summarizeCase } = useAIIntelligence();
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <Card className="h-full flex flex-col glass-card border-none rounded-none">
            <CardHeader className="p-4 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg font-display text-primary">
                    <Brain className="h-5 w-5" />
                    AI Intelligence
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                        {/* Summary Section */}
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                    <Sparkles className="h-4 w-4 text-amber-400" />
                                    Case Summary
                                </h3>
                                {!summary && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-amber-500/30 hover:bg-amber-500/10"
                                        onClick={() => summarizeCase(docketId, pdfUrl || '')}
                                        disabled={isSummarizing || !pdfUrl}
                                    >
                                        {isSummarizing ? 'Generating...' : 'Analyze PDF'}
                                    </Button>
                                )}
                            </div>

                            {isSummarizing ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-4/6" />
                                </div>
                            ) : summary ? (
                                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm leading-relaxed text-foreground/90 font-serif">
                                    {summary}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">
                                    Generate an AI summary of the case documents to get instant insights into facts and legal points.
                                </p>
                            )}
                        </section>

                        {/* Precedent Search */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                <Search className="h-4 w-4 text-blue-400" />
                                Find Precedents
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 bg-muted/50 border border-border/50 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Search Indian Kanoon..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Button size="sm" className="h-8 px-2">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </section>

                        {/* Key Citations */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                <ListChecks className="h-4 w-4 text-green-400" />
                                Points of Law
                            </h3>
                            <div className="space-y-2">
                                <div className="p-2 border border-border/50 rounded-lg text-xs hover:bg-muted/30 cursor-pointer transition-colors">
                                    Section 482 CrPC - Inherent Powers
                                </div>
                                <div className="p-2 border border-border/50 rounded-lg text-xs hover:bg-muted/30 cursor-pointer transition-colors">
                                    Article 226 - Writ Jurisdiction
                                </div>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
