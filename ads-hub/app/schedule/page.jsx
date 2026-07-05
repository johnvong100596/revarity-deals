import { Suspense } from "react";
import ScheduleClient from "@/app/components/ScheduleClient";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  // Suspense: ScheduleClient reads search params (?pick / ?connect_error from the Meta OAuth flow).
  return (
    <Suspense fallback={null}>
      <ScheduleClient />
    </Suspense>
  );
}
