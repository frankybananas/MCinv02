import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-700 mb-4">
          LotLynx runs at <span className="font-mono">htg.lotlynx.app</span>. We use your
          phone number and limited account information so that you can securely sign in,
          manage vehicle inventory, and connect optional services like Facebook for
          marketing posts.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          We store only the minimum information needed to operate the service, such as
          your phone number, basic profile details, dealership configuration and
          marketing preferences. For Facebook connections, access tokens are encrypted
          and stored securely as described in our technical documentation.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          We do not sell your personal information. Data may be processed and stored by
          our infrastructure providers in order to deliver the service (for example
          hosting, databases and log processing).
        </p>
        <p className="text-sm text-gray-700 mb-4">
          You may request access to or deletion of your personal data at any time by
          contacting our support team.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          For more details about how we handle deletion of data, please see our{' '}
          <Link href="/data-deletion" className="underline">
            Data Deletion Policy
          </Link>
          .
        </p>
        <p className="text-sm text-gray-700">
          If you have any questions about this Privacy Policy, contact us at{' '}
          <a href="mailto:support@lotlynx.app" className="underline">
            support@lotlynx.app
          </a>
          .
        </p>
      </div>
    </main>
  );
}
