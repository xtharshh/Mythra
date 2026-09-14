// Milestone modal: 100% completion → brag card + social share.
import { useEffect, useState } from "react";
import { milestoneLinks, milestoneText, nativeShareCard, paintMilestoneCard } from "../social/milestone";
import type { MilestoneStats } from "../social/milestone";
import { Icon } from "./icons";

export function MilestoneModal({ stats, ground, onClose }: { stats: MilestoneStats; ground: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const text = milestoneText(stats);
  const page = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    void paintMilestoneCard(stats, ground).then((b) => {
      if (!alive) return;
      setBlob(b);
      obj = URL.createObjectURL(b);
      setUrl(obj);
    }).catch(() => undefined);
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = async () => {
    if (blob && (await nativeShareCard(blob, text))) return;
    // fallback: download the card
    if (blob && url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "mythra-milestone.png";
      a.click();
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" style={{ width: "min(640px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="case-kicker">Milestone · case closed · 100%</div>
        <h3 style={{ margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>
          {stats.worldName} — solved by {stats.user}
        </h3>
        {url ? (
          <img src={url} alt="MYTHRA milestone card" style={{ width: "100%", borderRadius: 6, border: "1px solid var(--border-strong)" }} />
        ) : (
          <div className="muted">Painting your brag card…</div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => void share()}><Icon name="spark" size={13} /> Share / Save card</button>
          <button className="btn-ghost" onClick={() => { void navigator.clipboard?.writeText(`${text} ${page}`); }}>Copy text</button>
          <button className="btn-ghost" onClick={onClose}>Keep exploring</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          {milestoneLinks(text, page).map((l) => (
            <a key={l.label} className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
