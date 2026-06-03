"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Cinematic hero. The 8 stills crossfade underneath (pure CSS) and double as the fallback. A looping film
 * fades in ONLY once it can actually play, so a missing/slow mp4 never flashes a broken frame.
 *
 * It tries `sources` in order — the World Tour journey first, then the prior hero loop — so dropping
 * /public/hero/world-tour.mp4 auto-upgrades the hero with no code change, and nothing regresses while it's
 * absent (a 404 just advances to the next source; if all fail, the still crossfade carries it).
 */
export default function HeroVideo({ scenes = [], heroDur = 40, sources = ["/hero/world-tour.mp4", "/hero/hero-loop.mp4"], children }) {
  const [idx, setIdx] = useState(0);
  const [videoOn, setVideoOn] = useState(false);
  const videoRef = useRef(null);
  const poster = scenes[0] ? `/hero/${scenes[0]}.png` : undefined;
  const src = sources[idx];

  // `canplay` can fire BEFORE React attaches its handler (cached / fast mp4), so onCanPlay alone is unreliable —
  // it would leave the video invisible (opacity 0) under the still layers, which then keep animating and flicker.
  // Re-check readiness on mount / src change (and onPlaying/onLoadedData below) so videoOn reliably flips true.
  useEffect(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 3) setVideoOn(true);
  }, [src]);

  return (
    <header className={"hero" + (videoOn ? " video-on" : "")} style={{ "--herodur": `${heroDur}s` }}>
      {scenes.map((n, i) => (
        <div key={n} className="scene" style={{ backgroundImage: `url(/hero/${n}.png)`, animationDelay: `${(-heroDur + i * 5).toFixed(0)}s` }} />
      ))}
      {src && (
        <video
          ref={videoRef}
          key={src}
          className={"scene-video" + (videoOn ? " on" : "")}
          src={src}
          poster={poster}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          onLoadedData={() => setVideoOn(true)}
          onCanPlay={() => setVideoOn(true)}
          onPlaying={() => setVideoOn(true)}
          onError={() => { setVideoOn(false); setIdx((i) => (i + 1 < sources.length ? i + 1 : i)); }}
        />
      )}
      <div className="hero-grad" />
      <div className="hero-in">
        {children || (
          <>
            <div className="k"><span className="d" /> What is Revarity Ads</div>
            <h1>Turn rooms into <em>income</em>.</h1>
            <p>Your creative studio writes the words, designs the frame, and films the dream — short-stay ads that feel like a getaway, screened and approved before a single dollar moves.</p>
            <div className="hero-cta">
              <Link className="btn" href="/create">Make your first ad →</Link>
              <Link className="btn ghost" href="/welcome">See how it works</Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
