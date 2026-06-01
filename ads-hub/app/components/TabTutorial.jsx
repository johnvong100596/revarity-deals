"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * One inline mini-tutorial per tab, mounted once in the layout. It auto-opens the FIRST time you land on
 * a tab (so we never explain it twice), then collapses to a small "How this works" reopen button. When a
 * /tutorials/<tab>.mp4 clip exists it fades in and replaces the written steps; until then the animated
 * step-walkthrough carries the explanation. Hidden on the home hero (/) and the full /welcome tour.
 */
const TUTORIALS = {
  "/create": {
    title: "Create",
    blurb: "Spin up finished ads from a sentence — or from an ad you admire.",
    steps: [
      { n: "1", t: "Describe it (or paste inspiration)", d: "Type what you want in plain English, or drop an ad you like into the inspiration bar — we learn its framework and build an original, never a copy." },
      { n: "2", t: "Pick type, angle & format", d: "Image, copy-only, or a short b-roll video. Choose an angle and the placement size." },
      { n: "3", t: "Generate until one clicks", d: "Make as many as you want — everything lands in the Review queue. Nothing goes live from here." },
    ],
  },
  "/swipe": {
    title: "Mine winners",
    blurb: "Pull proven hooks from the swipe library to feed Create.",
    steps: [
      { n: "1", t: "Browse the swipe library", d: "Reference ads grouped by hook, angle, and framework — patterns that already perform." },
      { n: "2", t: "Save what fits our owner", d: "Keep the ones that match short-term-rental owners; they become inspiration for new originals." },
      { n: "3", t: "Send to Create", d: "Use a saved pattern as the inspiration input — the studio builds an original from it." },
    ],
  },
  "/review": {
    title: "Review & approve",
    blurb: "The gate. Nothing moves forward without your yes.",
    steps: [
      { n: "1", t: "Scan each creative + its auto-QA", d: "Every ad shows its copy and a pass / hold / fail verdict at a glance." },
      { n: "2", t: "Approve, hold, or reject", d: "One click each. Use ‘Approve all QA-pass’ to move fast on the clean ones." },
      { n: "3", t: "Save your decisions", d: "Approved ads become available to Schedule. No money is ever spent on this screen." },
    ],
  },
  "/schedule": {
    title: "Schedule",
    blurb: "Line up approved ads — you press go.",
    steps: [
      { n: "1", t: "Pick from approved ads", d: "Only ads you approved show up here, ready to queue." },
      { n: "2", t: "Choose accounts & timing", d: "Connect Instagram / Facebook / Meta and pick when each ad posts. Built-in suggestions help." },
      { n: "3", t: "You launch it", d: "Posting and spend are always a human action — the studio never pushes live on its own." },
    ],
  },
  "/budget": {
    title: "Budget",
    blurb: "Plan the spend before a single dollar moves.",
    steps: [
      { n: "1", t: "Set your monthly budget", d: "Enter the total you’re willing to spend this month — the plan splits it for you." },
      { n: "2", t: "Split test vs. scale", d: "Send a slice to testing fresh angles and the rest to scaling proven winners." },
      { n: "3", t: "Set a target cost-per-lead", d: "Give it your max CPL and it estimates the leads that budget should produce. Nothing auto-spends." },
    ],
  },
  "/monitor": {
    title: "Monitor",
    blurb: "Watch what’s live and double down on winners.",
    steps: [
      { n: "1", t: "See live performance", d: "Once spend is live and Meta Ads is connected, CPL / CPC / CPA show per creative." },
      { n: "2", t: "Spot the winners", d: "The loop flags the strongest creatives automatically." },
      { n: "3", t: "Scale by hand", d: "You decide what to scale — a human always makes the spend call." },
    ],
  },
};

export default function TabTutorial() {
  const path = usePathname();
  const cfg = TUTORIALS[path];
  const tab = path ? path.replace(/^\//, "") : "";
  const [open, setOpen] = useState(false);
  const [vidOk, setVidOk] = useState(false);

  // Auto-open the first time on each tab; remember it so we don't explain twice.
  useEffect(() => {
    if (!cfg) return;
    setVidOk(false);
    try {
      if (!localStorage.getItem("rev_tut_" + tab)) {
        setOpen(true);
        localStorage.setItem("rev_tut_" + tab, "1");
      } else {
        setOpen(false);
      }
    } catch {}
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null;

  if (!open) {
    return (
      <button className="tut-reopen" onClick={() => setOpen(true)}>
        <span className="tr-ico">▸</span> How the {cfg.title} tab works
      </button>
    );
  }

  return (
    <div className="tut">
      <div className="tut-head">
        <div>
          <div className="tut-kicker">Quick tour</div>
          <div className="tut-title">How the {cfg.title} tab works</div>
          {cfg.blurb && <div className="tut-blurb">{cfg.blurb}</div>}
        </div>
        <button className="tut-x" aria-label="Dismiss tutorial" onClick={() => setOpen(false)}>Got it ✕</button>
      </div>

      <video
        className={"tut-vid" + (vidOk ? " on" : "")}
        src={`/tutorials/${tab}.mp4`}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setVidOk(true)}
        onError={() => setVidOk(false)}
      />

      {!vidOk && (
        <div className="steps tut-steps">
          {cfg.steps.map((s) => (
            <div className="stepc" key={s.n}>
              <div className="stepn">{s.n}</div>
              <div><div className="stept">{s.t}</div><div className="stepd">{s.d}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
