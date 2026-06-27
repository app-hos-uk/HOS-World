import { ResolveLegalPage } from '@/components/legal/ResolveLegalPage';
import PrivacyPolicyStatic from './PrivacyPolicyStatic';

export default async function PrivacyPolicyPage() {
  return (
    <ResolveLegalPage slug="privacy-policy" fallbackTitle="Privacy Policy">
      <PrivacyPolicyStatic />
    </ResolveLegalPage>
  );
}
