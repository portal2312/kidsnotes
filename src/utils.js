const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

/**
 * JSON 파일을 경로로부터 동적으로 불러옵니다
 *
 * 절대 경로와 상대 경로를 모두 지원하며, 상대 경로는 현재 실행한 경로(process.cwd())를 기준으로 해석됩니다.
 * 파일 존재 여부와 JSON 파싱 오류를 검증합니다.
 *
 * @param {string} jsonPath - JSON 파일의 경로 (절대/상대 경로 모두 지원)
 * @returns {object} 파싱된 JSON 객체
 * @throws {Error} jsonPath가 제공되지 않았거나, 파일이 존재하지 않거나, JSON 파싱에 실패한 경우
 *
 * @example
 * // 상대 경로 사용 (현재 실행 경로 기준)
 * const data = loadJson("data/info.json");
 *
 * // 절대 경로 사용
 * const data = loadJson("/absolute/path/to/data.json");
 *
 * // 실행 예시:
 * // /Users/mkkim/projects/portal2312/kidsnotes 에서 실행 시
 * // loadJson("data/info.json") → /Users/mkkim/projects/portal2312/kidsnotes/data/info.json
 */
const loadJson = (jsonPath) => {
  if (!jsonPath) throw new Error("jsonPath is required");
  const absPath = path.isAbsolute(jsonPath)
    ? jsonPath
    : path.resolve(process.cwd(), jsonPath);
  if (!fs.existsSync(absPath)) throw new Error(`파일 없음: ${absPath}`);
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
};

/**
 * 날짜를 YYYY-MM-DD 문자열 형식으로 변환합니다
 *
 * 다양한 형태의 날짜 입력(문자열, Date 객체)을 받아 표준 YYYY-MM-DD 형식으로 변환합니다.
 * 이미 올바른 형식인 문자열은 그대로 반환하고, 잘못된 형식은 undefined를 반환합니다.
 *
 * @param {string|Date|undefined} dateInput - 변환할 날짜 (YYYY-MM-DD 문자열, Date 객체, 또는 undefined)
 * @returns {string|undefined} YYYY-MM-DD 형식의 문자열 또는 undefined (입력이 유효하지 않은 경우)
 *
 * @example
 * // 이미 올바른 형식인 문자열
 * toDateString("2025-08-18"); // → "2025-08-18"
 *
 * // Date 객체
 * toDateString(new Date("2025-08-18")); // → "2025-08-18"
 *
 * // ISO 문자열
 * toDateString("2025-08-18T10:30:00Z"); // → "2025-08-18"
 *
 * // 잘못된 입력
 * toDateString("invalid"); // → undefined
 * toDateString(null); // → undefined
 * toDateString(); // → undefined
 */
const toDateString = (dateInput) => {
  if (!dateInput) return undefined;
  if (typeof dateInput === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;
    const dt = new Date(dateInput);
    if (!isNaN(dt)) return dt.toISOString().slice(0, 10);
    return undefined;
  }
  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput.toISOString().slice(0, 10);
  }
  return undefined;
};

/**
 * 생성일시와 ID를 조합하여 파일명을 생성합니다
 *
 * ISO 8601 형식의 날짜/시간 문자열을 YYYYMMDD-HHMMSS 형태로 변환하고
 * ID와 확장자를 조합하여 유니크한 파일명을 생성합니다.
 *
 * @param {string} createdAt - ISO 형식의 생성 일시 (예: "2023-12-25T10:30:45")
 * @param {string|number} id - 파일 ID (숫자 또는 문자열)
 * @param {string} [ext=".jpg"] - 파일 확장자 (점 포함, 기본값: ".jpg")
 * @returns {string} 생성된 파일명 (예: "20231225-103045-12345.jpg")
 * @throws {Error} createdAt 또는 id가 제공되지 않은 경우
 *
 * @example
 * // 기본 사용법 (jpg)
 * const filename = generateFilename("2023-12-25T10:30:45", "12345");
 * // → "20231225-103045-12345.jpg"
 *
 * // 다른 확장자 지정
 * const filename = generateFilename("2023-12-25T10:30:45", "12345", ".png");
 * // → "20231225-103045-12345.png"
 *
 * // 확장자에서 점 자동 추가
 * const filename = generateFilename("2023-12-25T10:30:45", "12345", "mp4");
 * // → "20231225-103045-12345.mp4"
 */
const generateFilename = (createdAt, id, ext = ".jpg") => {
  if (!createdAt || !id) {
    throw new Error("createdAt and id are required");
  }

  const sanitizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return (
    createdAt.replace(/[-:]/g, "").replace("T", "-").substring(0, 15) +
    `-${id}${sanitizedExt}`
  );
};

/**
 * 디렉토리를 생성합니다 (존재하지 않는 경우)
 *
 * 재귀적으로 디렉토리를 생성하며, 이미 존재하는 경우 아무 작업을 하지 않습니다.
 * 파일이 존재하는 경로인 경우 오류를 발생시킵니다.
 *
 * @param {string} dirPath - 생성할 디렉토리 경로 (절대/상대 경로 모두 지원)
 * @param {boolean} [verbose=true] - 로그 출력 여부 (기본값: true)
 * @returns {boolean} 디렉토리가 새로 생성되었으면 true, 이미 존재하면 false
 * @throws {Error} dirPath가 제공되지 않았거나, 경로가 파일인 경우, 또는 디렉토리 생성에 실패한 경우
 *
 * @example
 * // 기본 사용법 (로그 출력됨)
 * const created = ensureDirectory("./downloads");
 *
 * // 로그 출력 없이 생성
 * const created = ensureDirectory("./downloads", false);
 *
 * // 중첩 디렉토리 생성
 * const created = ensureDirectory("./downloads/images/2025");
 */
const ensureDirectory = (dirPath, verbose = true) => {
  if (!dirPath) {
    throw new Error("Directory path is required");
  }

  if (fs.existsSync(dirPath)) {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path exists but is not a directory: ${dirPath}`);
    }
    return false;
  }

  try {
    fs.mkdirSync(dirPath, { recursive: true });
    if (verbose) {
      console.log(`📁 ${dirPath} 폴더가 생성되었습니다.`);
    }
    return true;
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
  }
};

/**
 * 파일이 존재하고 유효한 크기를 가지는지 확인합니다
 *
 * 파일의 존재 여부와 최소 크기 조건을 검증합니다.
 * 손상되거나 불완전한 파일을 필터링하는 데 유용합니다.
 *
 * @param {string} filePath - 확인할 파일의 경로
 * @param {number} [minSize=1] - 최소 파일 크기 (바이트 단위, 기본값: 1)
 * @returns {boolean} 파일이 존재하고 최소 크기 조건을 만족하면 true, 그렇지 않으면 false
 *
 * @example
 * // 기본 사용법 (1바이트 이상)
 * const isValid = isValidFile("./image.jpg");
 *
 * // 최소 크기 지정 (100바이트 이상)
 * const isValid = isValidFile("./image.jpg", 100);
 *
 * // 손상된 이미지 필터링 (1KB 이상)
 * const isValid = isValidFile("./image.jpg", 1024);
 */
const isValidFile = (filePath, minSize = 1) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size >= minSize;
  } catch {
    return false;
  }
};

/**
 * URL의 유효성을 검사합니다
 *
 * URL 형식과 허용된 프로토콜을 검증합니다.
 * 보안상 기본적으로 HTTPS만 허용하지만, 필요에 따라 다른 프로토콜도 허용할 수 있습니다.
 *
 * @param {string} url - 검사할 URL 문자열
 * @param {string[]} [allowedProtocols=["https:"]] - 허용할 프로토콜 배열 (기본값: ["https:"])
 * @returns {boolean} URL이 유효하고 허용된 프로토콜을 사용하면 true, 그렇지 않으면 false
 *
 * @example
 * // 기본 사용법 (HTTPS만 허용)
 * const isValid = isValidUrl("https://example.com/image.jpg");
 * // → true
 *
 * const isValid = isValidUrl("http://example.com/image.jpg");
 * // → false (HTTP는 기본적으로 허용되지 않음)
 *
 * // HTTP도 허용하는 경우
 * const isValid = isValidUrl("http://example.com/image.jpg", ["http:", "https:"]);
 * // → true
 *
 * // FTP 프로토콜 허용
 * const isValid = isValidUrl("ftp://example.com/file.txt", ["ftp:"]);
 * // → true
 */
const isValidUrl = (url, allowedProtocols = ["https:"]) => {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const urlObject = new URL(url);
    return allowedProtocols.includes(urlObject.protocol);
  } catch {
    return false;
  }
};

/**
 * 비동기 지연 함수
 *
 * 지정된 시간만큼 실행을 지연시키는 Promise를 반환합니다.
 * API 호출 제한, 애니메이션 타이밍 등에 유용합니다.
 *
 * @param {number} ms - 지연할 시간 (밀리초 단위, 음수 불허)
 * @returns {Promise<void>} 지연이 완료되면 resolve되는 Promise
 * @throws {Error} ms가 음수인 경우
 *
 * @example
 * // 1초 지연
 * await sleep(1000);
 *
 * // API 호출 간 지연
 * for (const item of items) {
 *   await processItem(item);
 *   await sleep(100); // 100ms 지연
 * }
 *
 * // 애니메이션 타이밍
 * element.classList.add('fade-in');
 * await sleep(300);
 * element.classList.remove('fade-in');
 */
const sleep = (ms) => {
  if (ms < 0) {
    throw new Error("Sleep duration must be non-negative");
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 포맷합니다
 *
 * 바이트 단위의 숫자를 KB, MB, GB 등의 단위로 변환하여 표시합니다.
 * 1024를 기준으로 계산하며, 소수점 자릿수를 지정할 수 있습니다.
 *
 * @param {number} bytes - 바이트 크기 (음수나 0은 "0 Bytes"로 표시)
 * @param {number} [decimals=2] - 소수점 자릿수 (기본값: 2, 음수는 0으로 처리)
 * @returns {string} 포맷된 크기 문자열 (예: "1.23 MB", "456.78 KB")
 *
 * @example
 * // 기본 사용법 (소수점 2자리)
 * const size = formatFileSize(1234567);
 * // → "1.18 MB"
 *
 * // 소수점 없이 표시
 * const size = formatFileSize(1234567, 0);
 * // → "1 MB"
 *
 * // 다양한 크기 예시
 * formatFileSize(0);          // → "0 Bytes"
 * formatFileSize(1024);       // → "1.00 KB"
 * formatFileSize(1048576);    // → "1.00 MB"
 * formatFileSize(1073741824); // → "1.00 GB"
 */
const formatFileSize = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * 배열을 지정된 크기의 청크로 나눕니다
 *
 * 큰 배열을 작은 단위로 나누어 배치 처리나 페이지네이션에 활용할 수 있습니다.
 * 마지막 청크는 지정된 크기보다 작을 수 있습니다.
 *
 * @param {Array} array - 나눌 배열
 * @param {number} chunkSize - 각 청크의 크기 (양수여야 함)
 * @returns {Array[]} 청크로 나뉜 배열들의 배열
 * @throws {Error} 첫 번째 인자가 배열이 아니거나, chunkSize가 0 이하인 경우
 *
 * @example
 * // 기본 사용법
 * const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const chunks = chunkArray(items, 3);
 * // → [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]
 *
 * // 배치 처리 예시
 * const urls = ["url1", "url2", "url3", "url4", "url5"];
 * const batches = chunkArray(urls, 2);
 * for (const batch of batches) {
 *   await Promise.all(batch.map(downloadFile));
 * }
 *
 * // 빈 배열 처리
 * const empty = chunkArray([], 5);
 * // → []
 */
const chunkArray = (array, chunkSize) => {
  if (!Array.isArray(array)) {
    throw new Error("First argument must be an array");
  }

  if (chunkSize <= 0) {
    throw new Error("Chunk size must be positive");
  }

  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * 시간을 사람이 읽기 쉬운 형태로 포맷합니다
 *
 * 초 단위의 시간을 시간, 분, 초 조합으로 변환하여 한국어로 표시합니다.
 * 0에 가까운 값이나 음수는 "0초"로 표시됩니다.
 *
 * @param {number} seconds - 초 단위의 시간 (음수는 0초로 처리)
 * @returns {string} 포맷된 시간 문자열 (예: "2분 30초", "1시간 5분", "45초")
 *
 * @example
 * // 다양한 시간 포맷 예시
 * formatDuration(30);     // → "30초"
 * formatDuration(90);     // → "1분 30초"
 * formatDuration(3661);   // → "1시간 1분 1초"
 * formatDuration(3600);   // → "1시간"
 * formatDuration(120);    // → "2분"
 * formatDuration(0);      // → "0초"
 * formatDuration(-5);     // → "0초"
 *
 * // 실제 사용 예시
 * const startTime = Date.now();
 * // ... 작업 수행 ...
 * const elapsed = (Date.now() - startTime) / 1000;
 * console.log(`작업 시간: ${formatDuration(elapsed)}`);
 */
const formatDuration = (seconds) => {
  if (seconds < 0) return "0초";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);

  return parts.join(" ");
};

/**
 * 브라우저에서 URL을 여는 함수
 *
 * 운영체제별로 적절한 명령어를 사용하여 기본 브라우저에서 URL을 엽니다.
 * macOS, Windows, Linux를 지원합니다.
 *
 * @param {string} url - 열고자 하는 URL
 * @throws {Error} URL이 제공되지 않은 경우
 *
 * @example
 * // 웹사이트 열기
 * openInBrowser("https://www.google.com");
 *
 * // 로컬 파일 열기
 * openInBrowser("file:///Users/user/document.html");
 *
 * // API 엔드포인트 열기
 * openInBrowser("https://api.example.com/data");
 */
const openInBrowser = (url) => {
  if (!url) {
    throw new Error("URL is required");
  }

  const platform = process.platform;
  let command;

  switch (platform) {
    case "darwin": // macOS
      command = `open "${url}"`;
      break;
    case "win32": // Windows
      command = `start "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`❌ 오류 발생: ${error.message}`);
    } else {
      console.log(`🌐 열림: ${url}`);
    }
  });
};

module.exports = {
  loadJson,
  toDateString,
  generateFilename,
  ensureDirectory,
  isValidFile,
  isValidUrl,
  sleep,
  formatFileSize,
  chunkArray,
  formatDuration,
  openInBrowser,
};
