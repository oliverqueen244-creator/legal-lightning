import { useState, useEffect } from 'react';
import { Search, X, Clock, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLawyerSearch } from '@/hooks/useLawyerSearch';
import { useLiveBoard } from '@/hooks/useLiveBoard';

interface LawyerSearchPanelProps {
  /** The selected date to search for cases (yyyy-MM-dd format) */
  selectedDate?: string;
}

/**
 * LawyerSearchPanel - Search for another lawyer's cases
 * 
 * FIX: Now accepts selectedDate prop to search the correct date
 * instead of always searching today's date.
 */
export function LawyerSearchPanel({ selectedDate }: LawyerSearchPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const { 
    searchTerm, 
    results, 
    isLoading, 
    isFetched,
    search, 
    getRecentSearches, 
    clearRecentSearches,
    getMatchedSide 
  } = useLawyerSearch(selectedDate);
  const { data: liveBoards } = useLiveBoard();
  
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, [results]);

  const handleSearch = () => {
    if (inputValue.trim()) {
      search(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRecentClick = (term: string) => {
    setInputValue(term);
    search(term);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const getLiveBoardForItem = (item: { court_location: string | null; court_room_no: string | null }) => {
    return liveBoards?.find(
      (board) => board.court_location === item.court_location && board.court_no === item.court_room_no
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex items-center gap-2 mb-2">
        <User className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground tracking-wide">
          Search Another Lawyer's Cases
        </h2>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter lawyer name..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-8"
          />
          {inputValue && (
            <button
              onClick={() => setInputValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={!inputValue.trim() || isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && !searchTerm && (
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Recent:</span>
          {recentSearches.map((term) => (
            <Badge
              key={term}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => handleRecentClick(term)}
            >
              {term}
            </Badge>
          ))}
          <button
            onClick={handleClearRecent}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : isFetched && searchTerm ? (
        <>
          <div className="text-sm text-muted-foreground">
            {results.length > 0 ? (
              <>Results for "<span className="font-medium text-foreground">{searchTerm}</span>" ({results.length} cases found)</>
            ) : (
              <>No cases found for "<span className="font-medium text-foreground">{searchTerm}</span>" today</>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No matching cases found</p>
              <p className="text-xs mt-2">Try searching with a different name or spelling</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item) => {
                const matchedSide = getMatchedSide(item);
                const liveBoard = getLiveBoardForItem(item);
                const distance = liveBoard ? (item.item_no ?? 0) - (liveBoard.current_item ?? 0) : null;

                return (
                  <Card key={item.id} className="glass-card border-border/50 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-primary">
                              {item.case_number}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Court {item.court_room_no}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Item #{item.item_no}
                            </Badge>
                          </div>

                          {/* Matched Side Indicator */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={matchedSide === 'petitioner' ? 'default' : matchedSide === 'respondent' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {matchedSide === 'both' 
                                ? '⚖️ Both Sides' 
                                : matchedSide === 'petitioner' 
                                  ? '🟢 Petitioner Side' 
                                  : '🔵 Respondent Side'}
                            </Badge>
                            {distance !== null && distance >= 0 && (
                              <span className="text-xs text-muted-foreground">
                                {distance === 0 ? '🔴 NOW' : `${distance} away`}
                              </span>
                            )}
                          </div>

                          {/* Party Names with Highlighting */}
                          <div className="text-sm text-muted-foreground truncate">
                            <span className={matchedSide === 'petitioner' || matchedSide === 'both' ? 'font-medium text-foreground' : ''}>
                              {item.petitioner_lawyer || 'N/A'}
                            </span>
                            <span className="mx-2">vs</span>
                            <span className={matchedSide === 'respondent' || matchedSide === 'both' ? 'font-medium text-foreground' : ''}>
                              {item.respondent_lawyer || 'N/A'}
                            </span>
                          </div>

                          {/* Petitioner vs Respondent */}
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {item.petitioner} vs {item.respondent}
                          </div>
                        </div>

                        {/* Location Badge */}
                        <Badge variant="outline" className="shrink-0">
                          {item.court_location}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Search for another lawyer's cases</p>
          <p className="text-xs mt-2">Enter the lawyer's name to see their cases for today</p>
        </div>
      )}
    </div>
  );
}
