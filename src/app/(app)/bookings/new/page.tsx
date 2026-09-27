import { PageHeader } from "@/components/PageHeader";
import { BookingForm } from "@/features/forms/LedgerForms";
import { bookingFormOptions } from "@/server/queries";
import { requireSession } from "@/server/session";

export default async function NewBookingPage() {
  const session = await requireSession();
  const options = await bookingFormOptions(session);
  return (
    <div>
      <PageHeader eyebrow="Bookings" title="Post a booking" detail="Revenue stays gross. Platform fees are posted as expenses. The payout is the cash you expect in the bank." />
      <BookingForm properties={options.properties} customers={options.customers} />
    </div>
  );
}
