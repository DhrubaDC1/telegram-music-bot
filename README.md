# Telegram FLAC Music Bot

Phase 1 saves original `.flac` files to `./data/music/inbox/` without
transcoding or buffering whole files in memory.

## Start

1. Copy missing keys from `.env.example` into `.env`. Get `TELEGRAM_API_ID`
   and `TELEGRAM_API_HASH` from <https://my.telegram.org/apps>.
2. Before first Local Bot API start, call `logOut` once against
   `https://api.telegram.org` for this bot. Telegram requires this when moving
   away from its hosted Bot API server.
3. Create the host music directory as the user running Docker:

   ```sh
   mkdir -p data/music/inbox
   ```

4. Start both services:

   ```sh
   docker compose up --build -d
   ```

5. Follow bot logs:

   ```sh
   docker compose logs -f telegram-music-bot
   ```

Compose uses its default private network. Port `8081` is exposed only on
localhost so `npm start` can also use the local server with
`TELEGRAM_BOT_API_ROOT=http://localhost:8081`.

The named `telegram-bot-api-data` volume is mounted at the same absolute path
in both containers because official local mode returns local file paths. The
bot mounts it read-only and streams files into the `./data/music:/music` bind
mount.
