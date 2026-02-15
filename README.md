# KidsNotes

1. Go to [kidsnote](https://www.kidsnote.com/). Then, try Login.
2. Go to [info](https://www.kidsnote.com/api/v1/me/info/) URL. Then, save to `data/info.json`
3. Go to [Centers](#centers).

## Centers

**Read**:

```bash
node src/centers.js read --info data/info.json --open
```

- `--info`: My information data path (Required)
- `--open`: Open current browser

> [!IMPORTANT]
> Save to file. For example: `data/centers/48652.json`

## Reports

알림장

**Read**:

```bash
node src/reports.js read \
--info data/info.json \
--center data/centers/48652.json \
9999 2025-08-12 $(date "+%Y-%m-%d") --open
```

- `--info`: My information data path (Required)
- `--center`: My center data path (Required)
- `9999`: Page size
- `2025-08-12`: Start date
- `$(date "+%Y-%m-%d")`: End date, Today
- `--open`: Open current browser

> [!IMPORTANT]
> Save the response JSON context file to `data/reports/current.json` after open URLs.

**Merge**:

Merge multiple JSON report files into one.

```bash
node src/reports.js merge \
data/reports/current.json \
data/reports/2025.json \
--save data/reports/merged.json
```

- `data/reports/20260211.json`: First report file
- `data/reports/20260213.json`: Second report file
- `--save`: Output file path (Required)

**Download**:

 Download pictures using the report JSON file.

 ```bash
 node src/reports.js download \
 data/reports/current.json \
 pictures/2026
 ```

- `data/reports/current.json`: This report JSON file includes a URL for each picture.
- `pictures/2026`: Download directory (Optional)

## Notices

공지사항

**Read**:

```bash
node src/notices.js read \
--info data/info.json \
--center data/centers/48652.json \
9999 2025-09-07 --open
```

- `--info`: My information data path (Required)
- `--center`: My center data path (Required)
- `9999`: Page size
- `2025-09-07`: Search date
- `--open`: Open current browser

> [!IMPORTANT]
> Save the response JSON context file to `data/notices/current.json` after open URLs.

**Merge**:

Merge multiple JSON notice files into one.

```bash
node src/notices.js merge \
data/notices/current.json \
data/notices/old.json \
--save data/notices/merged.json
```

- `--save`: Output file path (Required)

**Download**:

Download pictures using the notice JSON file.

```bash
node src/notices.js download \
data/notices/current.json \
pictures/notices
```

- `data/notices/current.json`: This notice JSON file includes a URL for each picture.
- `pictures/notices`: Download directory (Optional)

## Sync Date from Filename

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
