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
    // data-palette: "law" = brand-kit/brand.json as written; "family" = tokens lifted from the live
    // Revarity properties (ATD dark theme / revarity.com greens). Cena arbitrates which one wins —
    // the sidebar toggle exists only for that comparison and persists per browser.
    <html lang="en" data-palette="law">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Manrope:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* apply the saved palette before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: `try{var p=localStorage.getItem("rev-palette");if(p==="family"||p==="law")document.documentElement.dataset.palette=p}catch(e){}` }} />
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
