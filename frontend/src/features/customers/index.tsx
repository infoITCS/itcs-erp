import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Customers"
      description="Customer master data. The list will be cursor-paginated and will not load the full table."
    />
  );
}
