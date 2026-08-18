# Telegram FLAC Music Bot

Phase 1 saves original `.flac` files to `./data/music/inbox/` without
transcoding or buffering whole files in memory.

Phase 2 watches that inbox and organizes valid FLACs into
`./data/music/library/Artist/Album/`, reading tags via `music-metadata` and
tracking everything (including SHA-256 dedup) in SQLite at
`./data/music/database/library.db`. Files missing artist/album/title go to
`./data/music/problematic/` untouched. See `src/music/processor.js` for the
pipeline. `library/`, `problematic/`, and `database/` are created
automatically; no manual `mkdir` needed for them.

Run a full inbox scan by hand (safe to run anytime, won't duplicate already-
processed tracks):

```sh
docker compose exec telegram-music-bot npm run process
```

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
