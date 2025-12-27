import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background pt-14">
      <div className="container max-w-4xl mx-auto p-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-6 text-sm">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Fusion, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                To use Fusion, you must:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Be at least 18 years old</li>
                <li>Be legally able to enter into binding contracts</li>
                <li>Not be prohibited from using the service under UK law or any other applicable jurisdiction</li>
                <li>Not have been previously banned from Fusion</li>
                <li>Have only one account (duplicate accounts are prohibited)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                When creating an account, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your information to keep it accurate</li>
                <li>Keep your password secure and confidential</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Subscription and Payments</h2>
              
              <h3 className="text-lg font-medium mb-2 mt-4">4.1 Subscription Tiers</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">Fusion offers:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Free Tier:</strong> Browse profiles and perform swipes</li>
                <li><strong>Premium Tier (£9.99/month):</strong> View matches, send messages, and make video calls</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">4.2 Billing</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Subscriptions are billed monthly in advance</li>
                <li>Payments are processed securely through Stripe</li>
                <li>Your subscription automatically renews unless cancelled</li>
                <li>You can cancel anytime through your device settings or account settings</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">4.3 Cancellation and Refunds</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Cancel your subscription at any time to stop future charges</li>
                <li>No refunds for partial months or unused subscription periods</li>
                <li>Access continues until the end of the current billing period after cancellation</li>
                <li>Refunds may be provided at our discretion for technical issues</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">4.4 Price Changes</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to change subscription prices with 30 days' notice. Existing subscribers will maintain their current rate until the next billing cycle after notification.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. User Conduct</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">You agree NOT to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Post false, misleading, or deceptive information</li>
                <li>Impersonate any person or entity</li>
                <li>Use photos that are not your own</li>
                <li>Harass, threaten, or abuse other users</li>
                <li>Share inappropriate, explicit, or offensive content</li>
                <li>Solicit money or financial information from other users</li>
                <li>Use the service for commercial purposes or spam</li>
                <li>Attempt to access accounts or data of other users</li>
                <li>Use automated systems or bots</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Content Guidelines</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">Profile photos and content must:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Show your face clearly</li>
                <li>Be appropriate and respectful</li>
                <li>Not contain nudity or sexually explicit material</li>
                <li>Not promote violence, hate, or discrimination</li>
                <li>Not violate intellectual property rights</li>
                <li>Comply with Islamic values and modesty standards</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                We reserve the right to remove content that violates these guidelines.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Face Verification</h2>
              <p className="text-muted-foreground leading-relaxed">
                Fusion uses AI-powered face verification to ensure profile authenticity. By using this feature, you consent to the processing of your facial data for verification purposes. Verification photos are processed securely and not shared publicly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Safety and Reporting</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Report users who violate these terms or make you feel unsafe</li>
                <li>Block users you don't wish to interact with</li>
                <li>We investigate all reports and may take action including warnings, suspension, or permanent bans</li>
                <li>False reports may result in account suspension</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of Fusion (including but not limited to software, text, designs, logos) are owned by Fusion and protected by copyright, trademark, and other intellectual property laws. You are granted a limited, non-exclusive license to use the service for personal, non-commercial purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Third-Party Links and Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Fusion may contain links to third-party websites or services. We are not responsible for the content, accuracy, or practices of these third parties. Your use of third-party services is at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                Fusion is provided "as is" and "as available" without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, or error-free. We make no guarantees about finding a match or relationship success.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the maximum extent permitted by law, Fusion shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our total liability shall not exceed the amount you paid for the service in the 12 months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate your account at any time for violations of these terms, suspicious activity, or at our discretion. You may delete your account at any time through account settings. Upon termination, your right to use the service immediately ceases.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms of Service at any time. We will notify you of material changes by posting the updated terms on this page and updating the "Last updated" date. Your continued use after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">15. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">16. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                Email: <a href="mailto:support@fusion.app" className="text-primary hover:underline">support@fusion.app</a>
              </p>
            </section>

            <section className="border-t pt-6 mt-8">
              <p className="text-muted-foreground text-xs leading-relaxed">
                By using Fusion, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please discontinue use of the service immediately.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
