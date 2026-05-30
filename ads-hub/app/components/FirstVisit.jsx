"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** On a first-ever visit (no localStorage flag), send the user to the /welcome tutorial once. */
export default function FirstVisit() {
  const router = useRouter();
  useEffect(() => {
    try { if (!localStorage.getItem("rev_onboarded")) router.replace("/welcome"); } catch {}
  }, [router]);
  return null;
}
