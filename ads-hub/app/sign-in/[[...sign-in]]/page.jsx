import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic"; // don't prerender (needs ClerkProvider at runtime)

export default function Page() {
  return (
    <div style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <SignIn />
    </div>
  );
}
