// Milestone show-off card (completion share): renders a 1200×630 PNG brag
// card on canvas — no assets, no deps. Shared via Web Share API or download
// + social intent links. Pure-ish; canvas only runs in the browser.

export interface MilestoneStats {
  user: string;
  worldName: string;
  theme: string;
  missions: number;
  missionsTotal: number;
  clues: number;
  cluesTotal: number;
  date: string;
}

export function milestoneText(s: MilestoneStats): string {
  return `I solved "${s.worldName}" on Mythio — ${s.missions}/${s.missionsTotal} missions, ${s.clues}/${s.cluesTotal} clues. Think you can beat ${s.user}?`;
}

export function milestoneLinks(text: string, url: string): { label: string; href: string }[] {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
}

/** Paint the brag card. Returns a PNG blob. Browser only. */
export async function paintMilestoneCard(s: MilestoneStats, ground = "#c1553b"): Promise<Blob> {
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#160a1e");
  bg.addColorStop(0.6, "#3b1428");
  bg.addColorStop(1, "#0b0605");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // planet
  const pg = g.createRadialGradient(950, 200, 20, 950, 200, 190);
  pg.addColorStop(0, "#ffb08a");
  pg.addColorStop(0.45, ground);
  pg.addColorStop(1, "rgba(20,8,4,0)");
  g.fillStyle = pg;
  g.beginPath();
  g.arc(950, 200, 190, 0, Math.PI * 2);
  g.fill();
  // stars
  g.fillStyle = "rgba(255,217,176,0.8)";
  for (let i = 0; i < 90; i++) {
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.fillStyle = "#ffb45e";
  g.font = "bold 34px monospace";
  g.fillText("Mythio · CASE CLOSED", 70, 100);
  g.fillStyle = "#fff3e0";
  g.font = "bold 72px Georgia, serif";
  const title = s.worldName.toUpperCase().slice(0, 26);
  g.fillText(title, 70, 190);
  g.fillStyle = "#c9a98a";
  g.font = "30px monospace";
  g.fillText(`solved by ${s.user}`, 70, 245);
  g.fillStyle = "#fff3e0";
  g.font = "bold 44px monospace";
  g.fillText(`${s.missions}/${s.missionsTotal} MISSIONS   ${s.clues}/${s.cluesTotal} CLUES`, 70, 330);
  g.fillStyle = "#c9a98a";
  g.font = "26px monospace";
  g.fillText(`${s.theme} · ${s.date}`, 70, 385);
  g.strokeStyle = "#ffb45e";
  g.lineWidth = 4;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = "rgba(255,180,94,0.9)";
  g.font = "24px monospace";
  g.fillText("forge any story into a playable world", 70, H - 70);
  return new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("card render failed"))), "image/png");
  });
}

/** Native share sheet with the card file when the browser allows it. */
export async function nativeShareCard(blob: Blob, text: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    const file = new File([blob], "mythio-milestone.png", { type: "image/png" });
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Mythio milestone", text });
      return true;
    }
  } catch {
    /* dismissed or unsupported */
  }
  return false;
}
