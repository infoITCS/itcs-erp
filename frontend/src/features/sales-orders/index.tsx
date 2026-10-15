import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Sales orders"
      description="Confirmed orders created from quotes. Lines stay normalized."
      group="Sales"
    />
  );
}
