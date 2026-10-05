import { Link } from "react-router-dom";

export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Contacts belong to a customer. Open a customer to add people, choose the primary contact, and review changes.
      </p>
      <Link to="/customers" className="mt-4 inline-block text-sm font-medium text-slate-900 underline">
        Go to customers
      </Link>
    </section>
  );
}
