
import { redirect } from 'next/navigation';

export default function InvoicesPage() {
  redirect('/post-auction?tab=invoices');
}
