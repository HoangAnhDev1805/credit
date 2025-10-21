"use client";
import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export default function CheckerConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkerDefaultBatchSize, setBatch] = useState<number>(5);
  const [checkerCardTimeoutMin, setTimeoutMin] = useState<number>(2);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/admin/site-config");
        const cfg = (res as any)?.data?.data?.siteConfig || {};
        if (cfg.checkerDefaultBatchSize != null) setBatch(Number(cfg.checkerDefaultBatchSize));
        if (cfg.checkerCardTimeoutSec != null) {
          const min = Math.max(1, Math.round(Number(cfg.checkerCardTimeoutSec) / 60));
          setTimeoutMin(min);
        }
      } catch (e: any) {
        setMsg(e?.response?.data?.message || e?.message || "Failed to load config");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        checkerDefaultBatchSize: Number(checkerDefaultBatchSize),
        checkerCardTimeoutSec: Number(checkerCardTimeoutMin) * 60,
      };
      const res = await apiClient.put("/admin/site-config", payload);
      if ((res as any)?.data?.success) setMsg("Saved successfully");
      else setMsg((res as any)?.data?.message || "Save failed");
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Cấu hình Checker</h1>
        <p className="text-sm text-muted-foreground">
          Thiết lập số lượng thẻ ZennoPoster lấy mỗi lần và thời gian chờ cho mỗi thẻ (sau thời gian này nếu chưa trả kết quả, hệ thống tự đánh dấu Unknown).
        </p>

        {msg && (
          <div className="text-sm border rounded-md p-3 bg-neutral-900/50 border-neutral-800">
            {msg}
          </div>
        )}

        {loading ? (
          <div>Đang tải...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">Số lượng thẻ lấy mỗi lần (Batch size)</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                value={checkerDefaultBatchSize}
                onChange={(e) => setBatch(Math.max(1, Number(e.target.value || 1)))}
              />
              <p className="text-xs text-muted-foreground mt-1">Số thẻ ZennoPoster có thể lấy mỗi lần qua /api/checkcc (LoaiDV=1).</p>
            </div>

            <div>
              <label className="block text-sm mb-2">Thời gian chờ mỗi thẻ (phút)</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                value={checkerCardTimeoutMin}
                onChange={(e) => setTimeoutMin(Math.max(1, Number(e.target.value || 1)))}
              />
              <p className="text-xs text-muted-foreground mt-1">Nếu ZennoPoster không POST kết quả (LoaiDV=2) trong thời gian này, hệ thống sẽ tự động đánh dấu thẻ là Unknown.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-sm"
              >
                {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
