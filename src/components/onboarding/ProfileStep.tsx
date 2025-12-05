import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MapPin } from 'lucide-react';

interface ProfileStepProps {
  data: {
    full_name: string;
    bar_registration_number: string;
    bench: 'JAIPUR' | 'JODHPUR' | '';
  };
  onChange: (data: ProfileStepProps['data']) => void;
}

export default function ProfileStep({ data, onChange }: ProfileStepProps) {
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
        <Label>Select Your Bench *</Label>
        <RadioGroup
          value={data.bench}
          onValueChange={(value) => onChange({ ...data, bench: value as 'JAIPUR' | 'JODHPUR' })}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="jaipur"
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              data.bench === 'JAIPUR'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="JAIPUR" id="jaipur" />
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
              data.bench === 'JODHPUR'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="JODHPUR" id="jodhpur" />
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="font-medium">Jodhpur Bench</p>
                <p className="text-xs text-muted-foreground">Circuit Bench</p>
              </div>
            </div>
          </Label>
        </RadioGroup>
      </div>
    </div>
  );
}
