import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin } from 'lucide-react';
import { PortalHealthBadge } from '@/components/dashboard/CourtStatusCard';

interface ProfileStepProps {
  data: {
    full_name: string;
    bar_registration_number: string;
    bench: 'JAIPUR' | 'JODHPUR' | 'BOTH' | '';
  };
  onChange: (data: ProfileStepProps['data']) => void;
}

export default function ProfileStep({ data, onChange }: ProfileStepProps) {
  const handleBenchChange = (bench: 'JAIPUR' | 'JODHPUR', checked: boolean) => {
    const currentBench = data.bench;
    
    if (checked) {
      // Adding a bench
      if (currentBench === '' || currentBench === bench) {
        onChange({ ...data, bench });
      } else if (currentBench === 'BOTH') {
        // Already both selected
        return;
      } else {
        // Other bench was selected, now both are selected
        onChange({ ...data, bench: 'BOTH' });
      }
    } else {
      // Removing a bench
      if (currentBench === 'BOTH') {
        // Remove this bench, keep the other
        onChange({ ...data, bench: bench === 'JAIPUR' ? 'JODHPUR' : 'JAIPUR' });
      } else if (currentBench === bench) {
        // Removing the only selected bench
        onChange({ ...data, bench: '' });
      }
    }
  };

  const isJaipurSelected = data.bench === 'JAIPUR' || data.bench === 'BOTH';
  const isJodhpurSelected = data.bench === 'JODHPUR' || data.bench === 'BOTH';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name *</Label>
        <Input
          id="full_name"
          placeholder="Enter your full name as per Bar Council"
          value={data.full_name}
          onChange={(e) => onChange({ ...data, full_name: e.target.value })}
          className="bg-background/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bar_registration">Bar Council Registration Number</Label>
        <Input
          id="bar_registration"
          placeholder="e.g., RAJ/1234/2020"
          value={data.bar_registration_number}
          onChange={(e) => onChange({ ...data, bar_registration_number: e.target.value })}
          className="bg-background/50"
        />
        <p className="text-xs text-muted-foreground">Optional but helps with verification</p>
      </div>

      <div className="space-y-3">
        <Label>Select Your Bench(es) *</Label>
        <p className="text-xs text-muted-foreground">
          You can select both benches if you practice at multiple locations
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Label
            htmlFor="jaipur"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              isJaipurSelected
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Checkbox
              id="jaipur"
              checked={isJaipurSelected}
              onCheckedChange={(checked) => handleBenchChange('JAIPUR', checked as boolean)}
            />
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="font-medium">Jaipur Bench</p>
                <p className="text-xs text-muted-foreground">Principal Bench</p>
              </div>
            </div>
          </Label>

          <Label
            htmlFor="jodhpur"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              isJodhpurSelected
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Checkbox
              id="jodhpur"
              checked={isJodhpurSelected}
              onCheckedChange={(checked) => handleBenchChange('JODHPUR', checked as boolean)}
            />
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="font-medium">Jodhpur Bench</p>
                <p className="text-xs text-muted-foreground">Circuit Bench</p>
              </div>
            </div>
          </Label>
        </div>

        {/* Portal Health Check Badge */}
        {(isJaipurSelected || isJodhpurSelected) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {isJodhpurSelected && <PortalHealthBadge bench="JODHPUR" />}
            {isJaipurSelected && <PortalHealthBadge bench="JAIPUR" />}
          </div>
        )}

        {data.bench === 'BOTH' && (
          <p className="text-xs text-primary flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Cases from both benches will be synced to your dashboard
          </p>
        )}
      </div>
    </div>
  );
}
