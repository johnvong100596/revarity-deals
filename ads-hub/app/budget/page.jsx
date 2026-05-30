import { loadConfig } from "@/lib/config";
import BudgetClient from "@/app/components/BudgetClient";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const cfg = await loadConfig();
  return <BudgetClient budgetMonthly={cfg.budgetMonthly} kpi={cfg.kpi} angles={cfg.angles} />;
}
