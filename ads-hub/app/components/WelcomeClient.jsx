"use client";
import { useRouter } from "next/navigation";

const STEPS = [
  { n: "1", t: "Tell it what you want", d: "Type a plain sentence — like “an ad about how much a Toronto condo could earn on Airbnb” — or paste an ad you already like. The studio writes the words and makes the picture (or a short video) for you." },
  { n: "2", t: "Look it over and approve", d: "You see everything it made. Keep the good ones with a thumbs-up, set the rest aside. Nothing leaves this screen without your yes." },
  { n: "3", t: "Connect your accounts", d: "Hook up Instagram, Facebook, or Meta Ads with one button. You choose which ads go to which account — it’s your account, your call." },
  { n: "4", t: "Pick when to post", d: "Drop your approved ads onto a schedule. Not sure when? The built-in ads expert suggests the best times and which ones to push first." },
  { n: "5", t: "See what works — and do more of it", d: "Once your ads are live, you’ll see which ones get the most views. The studio then makes more like the winners, automatically." },
];

const PROMISES = [
  { t: "You’re always in control", s: "Nothing posts and no money is spent until you approve it. Full stop." },
  { t: "Honest by design", s: "Real numbers shown as ranges — never inflated promises or fake countdowns." },
  { t: "Plain English", s: "No tech-speak anywhere. If something’s confusing, that’s our bug, not yours." },
];

export default function WelcomeClient() {
  const router = useRouter();
  const start = () => { try { localStorage.setItem("rev_onboarded", "1"); } catch {} router.push("/create"); };
  const done = () => { try { localStorage.setItem("rev_onboarded", "1"); } catch {} router.push("/"); };

  return (
    <>
      <header className="hero" style={{ height: 280, backgroundImage: "url(/hero/04-tulum-aerial.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="hero-grad" />
        <div className="hero-in">
          <div className="k"><span className="d" /> Welcome to Revarity Ads</div>
          <h1>Make ads that <em>win</em> — without the busywork.</h1>
          <p>Your studio writes the words, designs the picture, and helps you post — in plain English, with you in control the whole way.</p>
        </div>
      </header>

      <div className="sec"><h2>How it works — 5 simple steps</h2></div>
      <div className="steps">
        {STEPS.map((s) => (
          <div className="stepc" key={s.n}>
            <div className="stepn">{s.n}</div>
            <div><div className="stept">{s.t}</div><div className="stepd">{s.d}</div></div>
          </div>
        ))}
      </div>

      <div className="sec"><h2>What you can count on</h2></div>
      <div className="qa-row">
        {PROMISES.map((p) => <div className="qa" key={p.t}><div className="t">{p.t}</div><div className="s">{p.s}</div></div>)}
      </div>

      <div className="welcome-cta">
        <button className="btn" onClick={start}>Get started — make your first ad →</button>
        <button className="btn ghost" onClick={done}>Skip to the dashboard</button>
      </div>
    </>
  );
}
