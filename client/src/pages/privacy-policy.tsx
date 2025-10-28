import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-6 text-sm">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Fusion ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Muslim matchmaking platform. By using Fusion, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium mb-2 mt-4">2.1 Personal Information</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Name, email address, and password</li>
                <li>Profile information (age, gender, location, bio)</li>
                <li>Photos and verification selfies</li>
                <li>Religious preferences and practices</li>
                <li>Education and profession information</li>
                <li>Interests and personality traits</li>
                <li>Partner preferences</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">2.2 Usage Information</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">We automatically collect certain information when you use Fusion:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Device information (type, operating system, browser)</li>
                <li>IP address and approximate location</li>
                <li>Usage patterns (swipes, matches, messages)</li>
                <li>Video call history and duration</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">2.3 Payment Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                Payment information is processed securely by Stripe. We do not store your complete credit card details on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We use your information to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Create and manage your account</li>
                <li>Provide matchmaking services and show you compatible profiles</li>
                <li>Verify your identity through AI face verification</li>
                <li>Process your subscription payments</li>
                <li>Enable messaging and video calling with your matches</li>
                <li>Send you notifications about matches, messages, and account activity</li>
                <li>Improve our services and develop new features</li>
                <li>Ensure safety and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We use the following third-party services:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Stripe:</strong> Payment processing and subscription management</li>
                <li><strong>Agora:</strong> Real-time video calling infrastructure</li>
                <li><strong>OpenAI:</strong> AI-powered face verification</li>
                <li><strong>Neon (PostgreSQL):</strong> Database hosting and management</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                These services have their own privacy policies and we recommend reviewing them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We do not sell your personal information. We may share your information:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>With other users as part of the matchmaking service (profile information, photos)</li>
                <li>With your designated chaperone if you enable this feature</li>
                <li>With service providers who assist in operating our platform</li>
                <li>When required by law or to protect rights and safety</li>
                <li>In connection with a business transfer or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure. We use encryption, secure protocols, and regular security assessments to safeguard your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Your Rights and Choices</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">You have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Access and download your personal information</li>
                <li>Update or correct your profile information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of promotional communications</li>
                <li>Block or report other users</li>
                <li>Cancel your subscription at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain information for legal compliance, fraud prevention, and dispute resolution purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Age Requirement</h2>
              <p className="text-muted-foreground leading-relaxed">
                Fusion is only available to users who are 18 years or older. We do not knowingly collect information from anyone under 18. If we learn we have collected information from someone under 18, we will delete it immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. International Users</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you are accessing Fusion from outside the United Kingdom, please be aware that your information may be transferred to, stored, and processed in countries where our servers are located.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date. Continued use of Fusion after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                Email: <a href="mailto:privacy@fusion.app" className="text-primary hover:underline">privacy@fusion.app</a>
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
