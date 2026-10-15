import { ModuleScaffold } from "@/components/layouts/ModuleScaffold.tsx";

export default function Page() {
  return (
    <ModuleScaffold
      title="Users"
      description="User accounts. Passwords stay hashed on the server and never reach this screen."
      group="System"
    />
  );
}
