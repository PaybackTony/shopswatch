"use client";

import { useState, useEffect } from "react";

/** Returns true when the app is running on localhost (any port). */
export function useIsDevMode(): boolean {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsDev(host === "localhost" || host === "127.0.0.1");
  }, []);

  return isDev;
}
