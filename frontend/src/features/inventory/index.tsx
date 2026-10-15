import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Inventory"
      description="Stock by warehouse. Movements are an append-only ledger."
      group="Supply"
    />
  );
}
