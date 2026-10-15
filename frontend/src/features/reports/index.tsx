import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Reports"
      description="Aggregates run on the read path. Reports do not load source rows into the browser."
      group="System"
    />
  );
}
