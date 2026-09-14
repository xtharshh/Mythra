// Legal pages (Discord verification): public Terms of Service + Privacy
// Policy served by the app itself. Plain language, no tracking beyond
// what the game needs to run.
import { Link } from "react-router-dom";

function Shell({ kicker, title, updated, children }: { kicker: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="layout" style={{ maxWidth: 760 }}>
      <div className="case-kicker">{kicker}</div>
      <h1 className="case-title" style={{ fontSize: 36 }}>{title}</h1>
      <div className="dossier-meta">Last updated: {updated}</div>
      <div className="card" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7 }}>{children}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn-ghost" to="/">Back to Dossier</Link>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <Shell kicker="MYTHRA · terms of service" title="Terms of play." updated="September 2026">
      <p><b>1. What this is.</b> MYTHRA is a proprietary browser mystery game by xtharshh. Playing the hosted game is permitted; everything else — copying, distributing, modifying, claiming it as your own — requires written permission (see LICENSE).</p>
      <p><b>2. Accounts.</b> You may play as a guest, sign in with email, or sign in with Discord. You are responsible for keeping your sign-in credentials safe.</p>
      <p><b>3. Your stories.</b> Worlds and continuations you create remain yours to show off (milestone cards, share codes). The engine, code, art, and platform remain the owner's property.</p>
      <p><b>4. Fair play.</b> No cheating, scraping, abusing the APIs, harassing fellow solvers, or uploading unlawful or hateful content. Contributions go through review for a reason.</p>
      <p><b>5. Availability.</b> The game and API run on a best-effort basis; progress lives in your browser and (when connected) on the game server. No uptime guarantees.</p>
      <p><b>6. Liability.</b> Provided "as is", without warranty. To the extent permitted by law, the owner is not liable for any loss arising from play.</p>
      <p><b>7. Contact.</b> Permission requests and takedowns: <b>https://buymeacoffee.com/xtharshh</b> (message there).</p>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell kicker="MYTHRA · privacy policy" title="Your data, plainly." updated="September 2026">
      <p><b>1. What we collect.</b> Email sign-in: your email address. Discord sign-in: your Discord user ID, username, display name, and avatar. Gameplay: progress, checkpoints, voice clips (your browser only), ratings, and presence while you play.</p>
      <p><b>2. Where it lives.</b> In your browser (localStorage, IndexedDB) and, when you connect the API, on the game server's database. Voice recordings never leave your browser unless you download and share them yourself.</p>
      <p><b>3. What we never do.</b> No sale of personal data. No third-party trackers or ads. API keys you paste into the Planner go only to the AI provider you chose.</p>
      <p><b>4. Deletion.</b> Reset in-game wipes local progress. For server-side deletion (account + progress + leaderboard entries), message <b>https://buymeacoffee.com/xtharshh</b> from the address or Discord account to forget.</p>
      <p><b>5. Children.</b> MYTHRA is a general-audience puzzle game, not directed at under-13s; guardians should supervise young explorers.</p>
      <p><b>6. Changes.</b> Material changes will be noted here with a new date.</p>
    </Shell>
  );
}
