// ACTIVATE CLERK: replace ../app/layout.jsx body with this pattern (wrap in ClerkProvider,
// add a UserButton to the sidebar area). Keeps the existing brand shell.
import "../app/globals.css";
import Sidebar from "../app/components/Sidebar";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";

export const metadata = { title: "ads.revarity.com · Operator Hub" };

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        </head>
        <body>
          <div className="shell">
            <Sidebar />
            <main className="main">
              <div style={{ position: "absolute", top: 24, right: 40 }}><SignedIn><UserButton /></SignedIn></div>
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
