import { loadConfig } from "@/lib/config";
import { keyStatus, COPY_MODEL } from "@/lib/connectors";
import SettingsClient from "@/app/components/SettingsClient";

export const dynamic = "force-dynamic";

const MODELS = {
  copy: COPY_MODEL,
  image: process.env.IMG_MODEL || "gemini-3.1-flash-image-preview",
  image_final: process.env.IMG_FINAL_MODEL || "gemini-3-pro-image-preview",
  video: process.env.HF_MODEL || "seedance1_5",
};

export default async function SettingsPage() {
  const config = await loadConfig();
  return <SettingsClient config={config} keys={keyStatus()} models={MODELS} />;
}
