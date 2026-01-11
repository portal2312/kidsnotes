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

### Reports

알림장

1. Open url

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

2. And, save file. For example: `data/reports/current.json`

3. Downloads pictures from a reports

   ```bash
   node src/downloads.js data/reports/current.json
   ```

   - `data/reports/current.json`: This report JSON file includes a URL for each picture.

### Notices

공지사항

1. Open url

   ```bash
   node src/notices.js data/info.json data/centers/48652.json 9999 2025-09-07 --open
   ```

   - `data/info.json`: My information data
   - `data/centers/48652.json`: My center data
   - `9999`: Page size
   - `2025-08-12`: Search date
   - `--open`: Open current browser

   > [!TIP]
   > For today:
   >
   > node src/notices.js data/info.json data/centers/48652.json 9999 $(date "+%Y-%m-%d") --open

2. And, save file. For example: `data/notices/current.json`

3. Downloads pictures from a reports

   ```bash
   node src/downloads.js data/notices/current.json
   ```

   - `data/reports/current.json`: This report JSON file includes a URL for each picture.

### Sync Date from Filename

파일 이름을 기반으로 생성 일자와 수정 일자를 동기화합니다.
macOS의 `SetFile` 명령어를 사용하며, 대량의 파일 처리 시 멀티 스레드를 활용하여 빠르게 수행됩니다.

**파일명 형식**: `{YYYYMMDD}-{HHmmss}-{file id}.{extension}`
(예: `20240304-080423-5279066601.jpg`)

**주요 기능**:

- **단일 파일**: 지정된 파일의 날짜를 변경합니다.
- **디렉터리**: 하위 모든 파일을 검색하여 병렬(Multi-thread)로 처리합니다.
- **중복 방지**: 이미 날짜가 일치하는 파일은 자동으로 건너뜁니다.
- **진행률 표시**: 실시간 진행 상황을 터미널에 표시합니다.

**사용법**:

```bash
# 단일 파일 처리
node src/sync_date_from_filename.js pictures/2024/20240304-080423-ID.jpg

# 디렉터리 일괄 처리
node src/sync_date_from_filename.js pictures/2024
```
