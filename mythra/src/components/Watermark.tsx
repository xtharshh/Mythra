// Ownership watermark — © xtharshh · Instagram @xt.harshh.
// Rendered on every page (and inside the Play fullscreen root) so the
// author's mark travels with the game wherever it is shown or recorded.
import { useEffect, useState } from "react";

export const WATERMARK_NAME = "xtharshh";
export const WATERMARK_HANDLE = "@xt.harshh";
export const WATERMARK_URL = "https://instagram.com/xt.harshh";

export function Watermark({ placement = "global" }: { placement?: "global" | "play" }) {
  // the global badge lives outside the fullscreen element, so it hides it
  // there; the play badge (inside the fullscreen root) takes over instead —
  // exactly one mark on screen, never two, never zero.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const show = placement === "play" ? fullscreen : !fullscreen;
  if (!show) return null;
  return (
    <div className={`watermark watermark-${placement}`} aria-label={`Made by ${WATERMARK_NAME} (${WATERMARK_HANDLE})`}>
      <span className="watermark-mark">© {WATERMARK_NAME}</span>
      <a
        className="watermark-link"
        href={WATERMARK_URL}
        target="_blank"
        rel="noreferrer"
        title={`Follow ${WATERMARK_NAME} on Instagram (${WATERMARK_HANDLE})`}
      >
        {WATERMARK_HANDLE}
      </a>
    </div>
  );
}
