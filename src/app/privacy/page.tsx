export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Privacy Policy</h1>
      <p className="text-sm text-zinc-500">Last updated: September 2026</p>
      <div className="space-y-5 text-sm leading-relaxed text-zinc-700">
        <p>
          TicketFlow values your privacy. We collect minimal account and booking data required to issue and verify tickets.
        </p>
        <h2 className="text-base font-bold text-zinc-900 pt-2">1. Information We Collect</h2>
        <p>
          Name, contact email, and phone number for booking confirmations, receipt generation, and gate check-in matching.
        </p>
        <h2 className="text-base font-bold text-zinc-900 pt-2">2. Payment Security</h2>
        <p>
          We do not store full credit card credentials or payment secrets on our servers. All transactions are processed through tokenized payment gateways.
        </p>
      </div>
    </div>
  );
}
