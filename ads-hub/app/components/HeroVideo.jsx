"use client";
import Link from "next/link";
import { useState } from "react";

/**
 * Cinematic hero. The 8 stills crossfade underneath (pure CSS) and double as the fallback; the looping
 * drone film (/hero/hero-loop.mp4) fades in ONLY once it can actually play, so a missing/slow mp4 never
 * flashes a broken frame. Drop the rendered mp4 into /public/hero/ and it lights up with no code change.
 */
export default function HeroVideo({ scenes = [], heroDur = 40, videoSrc = "/hero/hero-loop.mp4" }) {
  const [videoOn, setVideoOn] = useState(false);
  const poster = scenes[0] ? `/hero/${scenes[0]}.png` : undefined;

  return (
    <header className="hero" style={{ "--herodur": `${heroDur}s` }}>
      {scenes.map((n, i) => (
        <div key={n} className="scene" style={{ backgroundImage: `url(/hero/${n}.png)`, animationDelay: `${(-heroDur + i * 5).toFixed(0)}s` }} />
      ))}
      <video
        className={"scene-video" + (videoOn ? " on" : "")}
        src={videoSrc}
        poster={poster}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setVideoOn(true)}
        onError={() => setVideoOn(false)}
      />
      <div className="hero-grad" />
      <div className="hero-in">
        <div className="k"><span className="d" /> What is Revarity Ads</div>
        <h1>Turn rooms into <em>income</em>.</h1>
        <p>Your creative studio writes the words, designs the frame, and films the dream — short-stay ads that feel like a getaway, screened and approved before a single dollar moves.</p>
        <div className="hero-cta">
          <Link className="btn" href="/create">Make your first ad →</Link>
          <Link className="btn ghost" href="/welcome">See how it works</Link>
        </div>
      </div>
    </header>
  );
}
