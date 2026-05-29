// ACTIVATE CLERK: place at ../app/sign-in/[[...sign-in]]/page.jsx (and mirror for sign-up).
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0a0b" }}>
      <SignIn />
    </div>
  );
}
