import { Suspense } from "react";
import { loadConfig } from "@/lib/config";
import CreateClient from "@/app/components/CreateClient";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const cfg = await loadConfig(); // merged with Settings overrides so edited/custom angles show in Create
  return (
    <Suspense fallback={null}>
      <CreateClient angles={cfg.angles} formats={cfg.formats} />
    </Suspense>
  );
}
