import { getConfig } from "@/lib/config";
import CreateClient from "@/app/components/CreateClient";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  const cfg = getConfig();
  return <CreateClient angles={cfg.angles} formats={cfg.formats} />;
}
