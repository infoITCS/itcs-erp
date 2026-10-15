import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Invoices"
      description="Customer invoices. Posted invoices are corrected by reversal, not by silent edits."
      group="Sales"
    />
  );
}
