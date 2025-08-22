# KidsNotes

## Requirements

1. Go to [kidsnote](https://www.kidsnote.com/). Then, try Login.

2. Go to [info](https://www.kidsnote.com/api/v1/me/info/) URL. Then, save to `data/info.json`

## How to

1. Go to terminal

2. Save center file

   Execute:

   ```bash
   node src/centers.js data/info.json --open
   ```

   - `data/info.json`: My information data
   - `--open`: Open current browser

   Save to file. For example: `data/centers/48652.json`

3. Open reports url

   ```bash
   node src/reports.js data/info.json data/centers/48652.json 9999 2025-08-12 2025-08-12 --open
   ```

   - `data/info.json`: My information data
   - `data/centers/48652.json`: My center data
   - `9999`: Page size
   - `2025-08-12`: Start date
   - `2025-08-12`: End date
   - `--open`: Open current browser

   > [!TIP]
   > For today:
   >
   > node src/reports.js data/info.json data/centers/48652.json 9999 $(date "+%Y-%m-%d") $(date "+%Y-%m-%d") --open

4. And, save file. For example: `data/reports/current.json`

5. Downloads pictures from a reports

   ```bash
   node src/downloads.js data/reports/current.json
   ```

   - `data/reports/current.json`: This report JSON file includes a URL for each picture.
