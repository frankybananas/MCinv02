import Link from 'next/link';

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Data Deletion Policy</h1>
        <p className="text-sm text-gray-700 mb-4">
          You can request deletion of your personal data associated with LotLynx 
          at any time. This includes your user profile, phone number,
          dealership configuration and, where technically possible, related activity
          data.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          To request deletion, send an email from the address linked to your account to{' '}
          <a href="mailto:support@lotlynx.app" className="underline">
            support@lotlynx.app
          </a>{' '}
          with the subject line &quot;Data Deletion Request&quot;. We may need to verify your
          identity before processing the request.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          Deleting your LotLynx account does not automatically delete data held by
          third-party services that you have connected, such as Facebook. You may need
          to manage or delete content directly within those services according to their
          own policies.
        </p>
        <p className="text-sm text-gray-700 mb-4">
          Certain records may be retained where we are required to do so by law or for
          legitimate business purposes (for example, fraud prevention or accounting
          records). Such data will be minimised and protected.
        </p>
        <p className="text-sm text-gray-700">
          For more information about how we use and store personal data, please see our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
