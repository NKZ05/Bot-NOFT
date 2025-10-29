import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs";

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Charger les streamers depuis JSON
const rawData = fs.readFileSync("./streamers.json", "utf-8");
const streamers = JSON.parse(rawData);

// Suivi de l'état en live
let liveStatus = {};
streamers.forEach(s => liveStatus[s.name] = false);

// Obtenir le token Twitch
async function getTwitchAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  return data.access_token;
}

// Vérifier si un streamer est en live
async function isLive(streamerName, token) {
  const url = `https://api.twitch.tv/helix/streams?user_login=${streamerName}`;
  const res = await fetch(url, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`
    }
  });
  const data = await res.json();
  return data.data && data.data.length > 0;
}

// Vérifier tous les streamers
async function checkLive() {
  try {
    const token = await getTwitchAccessToken();

    for (const streamer of streamers) {
      const live = await isLive(streamer.name, token);

      if (live && !liveStatus[streamer.name]) {
        liveStatus[streamer.name] = true;

        const channel = await client.channels.fetch(process.env.CHANNEL_ID);

        const embed = new EmbedBuilder()
          .setTitle(`${streamer.name} est en live !`)
          .setDescription(`[Regarder le live sur Twitch](https://twitch.tv/${streamer.name})`)
          .setColor("#9146FF")
          .setThumbnail(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamer.name}-320x180.jpg`)
          .setTimestamp();

        await channel.send({ content: `<@&${streamer.roleId}>`, embeds: [embed] });
        console.log(`Notification envoyée pour ${streamer.name}`);
      } else if (!live && liveStatus[streamer.name]) {
        liveStatus[streamer.name] = false; // reset quand le stream se termine
      }
    }
  } catch (err) {
    console.error("Erreur dans checkLive :", err);
  }
}

// Lancer le bot
client.once("clientReady", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  checkLive(); // vérification immédiate
  setInterval(checkLive, 60 * 1000); // puis toutes les 60 secondes
});

client.login(process.env.DISCORD_TOKEN);
