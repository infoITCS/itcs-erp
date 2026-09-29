import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Settings"
      description="Company settings. Secrets stay in the API environment, not in this bundle."
    />
  );
}
