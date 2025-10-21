"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BlockedPage() {
  const searchParams = useSearchParams();
  const [tg, setTg] = useState<string>("");

  useEffect(() => {
    const fromQuery = searchParams.get("tg") || "";
    if (fromQuery) {
      setTg(fromQuery);
      try {
        window.localStorage.setItem("TELEGRAM_SUPPORT_URL", fromQuery);
      } catch {}
      return;
    }
    try {
      const fromStorage = window.localStorage.getItem("TELEGRAM_SUPPORT_URL") || "";
      if (fromStorage) setTg(fromStorage);
    } catch {}
  }, [searchParams]);

  const openTg = () => {
    if (tg) {
      window.open(tg, "_blank", "noopener,noreferrer");
    }
  };

  const copyTg = async () => {
    try {
      await navigator.clipboard.writeText(tg);
      alert("Telegram support link copied");
    } catch {}
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-950 text-white p-6">
      <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900/60 backdrop-blur p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Account Locked</h1>
        <p className="text-neutral-300">
          Your account has been locked. Please contact our Telegram support to get assistance.
        </p>
        <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-sm text-neutral-400 mb-2">Telegram Support</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              readOnly
              value={tg || "Not configured yet"}
              className="w-full rounded-md bg-neutral-800/80 border border-neutral-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                disabled={!tg}
                onClick={openTg}
                className="inline-flex items-center rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 px-4 py-2 text-sm font-medium"
              >
                Open Telegram
              </button>
              <button
                disabled={!tg}
                onClick={copyTg}
                className="inline-flex items-center rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-700 px-4 py-2 text-sm font-medium border border-neutral-700"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
        <div className="text-xs text-neutral-500">
          If this is a mistake, please reach out via Telegram and provide your username and registered email for verification.
        </div>
      </div>
    </div>
  );
}
