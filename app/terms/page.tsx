import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-700 mb-4">
          By using LotLynx at <span className="font-mono">htg.lotlynx.app</span>, you agree to
          these Terms of Service. If you do not agree, please do not use the
          application.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          You are responsible for all activity performed using your account, including
          any vehicle data added or updated and any marketing posts made to external
          services such as Facebook Pages.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          You must only connect Facebook accounts and Pages that you are authorised to
          manage. LotLynx does not own or control your Facebook assets; it simply helps
          you create and schedule content that you choose to publish.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          The service is provided on an &quot;as is&quot; basis, without warranties of any kind.
          We do not guarantee uninterrupted availability or permanent storage of data.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          We may update these Terms from time to time. Continued use of the service
          after changes are published will mean you accept the updated Terms.
        </p>
        <p className="text-sm text-gray-700">
          For information about how we collect and use data, please see our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          . If you have questions about these Terms, contact{' '}
          <a href="mailto:support@lotlynx.app" className="underline">
            support@lotlynx.app
          </a>
          .
        </p>
      </div>
    </main>
  );
}
