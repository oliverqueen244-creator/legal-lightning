import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { CONSENT_VERSION, type ConsentSelections } from './consentTypes';

interface Props {
  value: ConsentSelections;
  onChange: (next: ConsentSelections) => void;
}

export function ConsentStep({ value, onChange }: Props) {
  const set = (k: keyof ConsentSelections) => (checked: boolean) =>
    onChange({ ...value, [k]: checked });

  return (
    <div className="space-y-5">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          India's Digital Personal Data Protection Act, 2023 requires us to get your explicit,
          informed consent before processing your data. Each item below maps to a specific
          processing activity — you can revoke any of them later from Settings.
        </AlertDescription>
      </Alert>

      <label className="flex gap-3 items-start cursor-pointer">
        <Checkbox
          checked={value.privacyPolicy}
          onCheckedChange={set('privacyPolicy')}
          className="mt-1"
        />
        <span className="text-sm leading-relaxed">
          <strong>I have read and accept the </strong>
          <Link to="/privacy" target="_blank" className="text-primary underline inline-flex items-center gap-1">
            Privacy Policy <ExternalLink className="h-3 w-3" />
          </Link>
          <span> (version {CONSENT_VERSION}).</span>
          <br />
          <span className="text-muted-foreground text-xs">
            Required. Without this we cannot create your account.
          </span>
        </span>
      </label>

      <label className="flex gap-3 items-start cursor-pointer">
        <Checkbox
          checked={value.thirdPartyAi}
          onCheckedChange={set('thirdPartyAi')}
          className="mt-1"
        />
        <span className="text-sm leading-relaxed">
          <strong>Allow third-party AI processing of public causelist text.</strong>
          <br />
          <span className="text-muted-foreground text-xs">
            We send daily causelist text (already public on the High Court website) to Google
            Gemini, OpenAI, or OpenRouter for case extraction. No personal data you have entered
            is included. Required to populate your daily docket.
          </span>
        </span>
      </label>

      <label className="flex gap-3 items-start cursor-pointer">
        <Checkbox
          checked={value.telegramAlerts}
          onCheckedChange={set('telegramAlerts')}
          className="mt-1"
        />
        <span className="text-sm leading-relaxed">
          <strong>Optional: send my case alerts via Telegram.</strong>
          <br />
          <span className="text-muted-foreground text-xs">
            You can leave this off and use in-app notifications only. You can change this any time
            in Settings → Privacy.
          </span>
        </span>
      </label>
    </div>
  );
}
