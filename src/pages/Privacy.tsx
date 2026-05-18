import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * Privacy policy. The text below is a working draft to satisfy the
 * structural requirements of the DPDP Act 2023 (Section 5 notice).
 * THE LEGAL WORDING MUST BE REVIEWED BY COUNSEL BEFORE LAUNCH.
 */
export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Privacy Policy
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-2">
              Version 1.0 · Last updated 18 May 2026 · Effective immediately
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p className="text-sm bg-amber-500/10 border border-amber-500/30 rounded p-3">
              <strong>Draft notice.</strong> This policy is a structural draft. The final legal text
              is under review by counsel and may change before public launch.
            </p>

            <section>
              <h2>Who we are</h2>
              <p>
                Nyay-Hub is operated by Izafa Labs ("we", "us"). For purposes of the Digital
                Personal Data Protection Act, 2023 ("DPDP Act"), we are a Data Fiduciary. You can
                reach our Data Protection Officer at privacy@nyayhub.com.
              </p>
            </section>

            <section>
              <h2>What data we process</h2>
              <ul>
                <li>Account data: your email, name, role (Senior / Junior / Clerk / Admin / Intern), bar enrollment number, chamber membership.</li>
                <li>Practice data: cases you track, hearing schedules, judgments you check, documents you upload, name aliases you maintain.</li>
                <li>Operational data: app logs, error reports, session timestamps, audit trail of your case-modification actions.</li>
                <li>Third-party-sourced data: causelists published by the Rajasthan High Court, judgments published by Indian Kanoon.</li>
              </ul>
            </section>

            <section>
              <h2>Why we process it</h2>
              <p>
                Solely to provide the litigation-management service you have signed up for —
                showing your hearings, matching your name across causelists, syncing court
                documents, surfacing judgments, and enabling collaboration within your chamber.
                We do not sell your data. We do not use it to train AI models.
              </p>
            </section>

            <section>
              <h2>Your rights under the DPDP Act</h2>
              <ul>
                <li><strong>Right to access:</strong> download everything we hold about you from Settings → Privacy &amp; Data → Download my data.</li>
                <li><strong>Right to correct:</strong> edit your profile, aliases, and tracked cases at any time.</li>
                <li><strong>Right to erasure:</strong> Settings → Privacy &amp; Data → Delete my account. This anonymises your profile and removes your login. Audit-trail entries for shared chamber cases stay (anonymised authorship) so colleagues' work is not destroyed.</li>
                <li><strong>Right to grievance redressal:</strong> email privacy@nyayhub.com with the subject "DPDP request" and we respond within 7 business days.</li>
                <li><strong>Right to nominate:</strong> contact us if you want to nominate someone to exercise these rights on your behalf in the event of your incapacitation.</li>
              </ul>
            </section>

            <section>
              <h2>Sharing &amp; transfers</h2>
              <p>We share your data only with:</p>
              <ul>
                <li>Supabase (our infrastructure provider) — database, authentication, file storage.</li>
                <li>AI providers (Google, OpenAI, OpenRouter) — only the causelist text being parsed, for case-extraction. No PII you have entered is sent.</li>
                <li>2Captcha — for CAPTCHA solving when checking judgments on the eCourts portal.</li>
                <li>Indian Kanoon — only the case identifiers you explicitly search for.</li>
                <li>Telegram (when you opt in to alerts).</li>
              </ul>
              <p>
                Some of these processors are outside India. We rely on standard contractual safeguards. The
                Central Government has not yet notified a restricted-transfer country list under
                Section 16(2) of the DPDP Act; we will update this policy if and when it does.
              </p>
            </section>

            <section>
              <h2>Retention</h2>
              <p>
                We retain your data for as long as your account is active. Once you delete your
                account, profile data is anonymised within 24 hours. Audit trail entries are kept
                for 3 years (or longer if mandated by the Bar Council). Causelist and judgment
                data sourced from public records is retained indefinitely (it is public-record
                data, not your personal data).
              </p>
            </section>

            <section>
              <h2>Security</h2>
              <p>
                Data at rest is encrypted by our infrastructure provider. All connections use TLS.
                Service-role credentials are not shipped to your browser. Court documents are stored
                in a private bucket — only authenticated users can read them.
              </p>
            </section>

            <section>
              <h2>Children</h2>
              <p>
                Nyay-Hub is a professional tool for advocates. We do not knowingly collect data
                from anyone under 18. If you believe a minor has registered, email us.
              </p>
            </section>

            <section>
              <h2>Changes</h2>
              <p>
                Material changes are notified by in-app banner and email at least 14 days before
                taking effect. You may withdraw consent at any time, but doing so will end your
                ability to use the service.
              </p>
            </section>

            <section>
              <h2>Contact</h2>
              <p>
                Izafa Labs · privacy@nyayhub.com · Grievance Officer: same address, subject line
                "DPDP grievance".
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
