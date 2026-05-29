import { getConfig } from "@/lib/config";
import BudgetClient from "@/app/components/BudgetClient";

export const dynamic = "force-dynamic";

export default function BudgetPage() {
  const cfg = getConfig();
  return <BudgetClient budgetMonthly={cfg.budgetMonthly} kpi={cfg.kpi} angles={cfg.angles} />;
}
