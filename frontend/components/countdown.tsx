"use client";

import { useEffect, useState } from "react";

function formatRemaining(target: string) {
  const distance = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(distance / 86_400_000);
  const hours = Math.floor((distance % 86_400_000) / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  return distance === 0 ? "SESSION STARTED" : `${days}D ${hours}H ${minutes}M`;
}

export function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState("--D --H --M");
  useEffect(() => {
    const update = () => setLabel(formatRemaining(target));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [target]);
  return <span suppressHydrationWarning>{label}</span>;
}
