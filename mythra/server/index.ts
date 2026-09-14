// Local runner: `npm run dev:api`. (Vercel uses api/[...all].ts instead.)
import app from "./app.js";
import { discordConfigured } from "./discord.js";

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`Mythio API on :${port}`);
  console.log(discordConfigured() ? "Discord login: configured" : "Discord login: MISSING — set DISCORD_CLIENT_ID/SECRET in mythra/.env (see .env.example)");
});
