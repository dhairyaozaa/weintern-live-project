export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Terms of Service</h1>
      <p className="text-sm text-zinc-500">Last updated: September 2026</p>
      <div className="space-y-5 text-sm leading-relaxed text-zinc-700">
        <p>
          Welcome to TicketFlow. By accessing or using our ticketing marketplace and platform, you agree to these Terms.
        </p>
        <h2 className="text-base font-bold text-zinc-900 pt-2">1. Ticket Reservations & Inventory</h2>
        <p>
          Ticket holds remain active for 10 minutes. If purchase is not completed, seats are returned to public availability.
        </p>
        <h2 className="text-base font-bold text-zinc-900 pt-2">2. QR Gate Admission</h2>
        <p>
          Tickets contain cryptographically signed tokens. Duplicate attempts to check in will be flagged by gate scanners.
        </p>
        <h2 className="text-base font-bold text-zinc-900 pt-2">3. Organizer Verification</h2>
        <p>
          Organizers undergo administrative verification before payouts and event publishing are activated.
        </p>
      </div>
    </div>
  );
}
