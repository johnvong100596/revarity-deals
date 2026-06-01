import "./globals.css";
import Sidebar from "./components/Sidebar";
import TabTutorial from "./components/TabTutorial";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";

// Only initialize Clerk when keys are present; otherwise render the plain shell (Basic/open auth).
const USE_CLERK = process.env.AUTH_PROVIDER === "clerk" && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata = {
  title: "ads.revarity.com · Operator Hub",
  description: "Revarity marketing engine operator hub — create, generate, approve, budget, monitor.",
};

function Shell({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="aurora"><b className="b1" /><b className="b2" /><b className="b3" /></div>
        <div className="shell">
          <Sidebar />
          <main className="main">
            {USE_CLERK && (
              <div style={{ position: "absolute", top: 24, right: 40, zIndex: 10 }}>
                <SignedIn><UserButton /></SignedIn>
              </div>
            )}
            <TabTutorial />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({ children }) {
  return USE_CLERK ? <ClerkProvider><Shell>{children}</Shell></ClerkProvider> : <Shell>{children}</Shell>;
}
