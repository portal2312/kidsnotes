// utils에서 공통 함수들을 가져옵니다
const { loadJson, toDateString, openInBrowser } = require("./utils");
const path = require("path");

/**
 * 키즈노트 리포트 API URI들을 생성합니다
 *
 * JSON 파일로부터 자녀 정보와 센터 정보를 동적으로 로드하여
 * 키즈노트 리포트 API 호출을 위한 URI들을 생성합니다.
 * 날짜 필터링과 페이지 크기 설정을 지원합니다.
 *
 * @param {string} infoPath - 자녀 정보가 담긴 info.json 파일 경로 (절대/상대 경로 모두 지원)
 * @param {string} centerPath - 센터 정보가 담긴 center.json 파일 경로 (절대/상대 경로 모두 지원)
 * @param {number} [pageSize=9999] - 페이지당 아이템 수 (기본값: 9999)
 * @param {string|Date} [startDate] - 시작일 (YYYY-MM-DD 문자열 또는 Date 객체, 선택사항)
 * @param {string|Date} [endDate] - 종료일 (YYYY-MM-DD 문자열 또는 Date 객체, 선택사항)
 * @returns {string[]} 생성된 API URI 배열
 *
 * @example
 * // 기본 사용법 (날짜 필터 없음, 현재 실행 경로 기준)
 * const uris = generateReportURIs("data/info.json", "data/centers/1.json");
 *
 * // 페이지 크기 지정
 * const uris = generateReportURIs("data/info.json", "data/centers/1.json", 100);
 *
 * // 특정 날짜 범위로 필터링
 * const uris = generateReportURIs(
 *   "data/info.json",
 *   "data/centers/1.json",
 *   100,
 *   "2025-08-01",
 *   "2025-08-31"
 * );
 *
 * // Date 객체 사용
 * const uris = generateReportURIs(
 *   "data/info.json",
 *   "data/centers/1.json",
 *   100,
 *   new Date("2025-08-01"),
 *   new Date("2025-08-31")
 * );
 *
 * // 생성되는 URI 형태:
 * // "https://www.kidsnote.com/api/v1_2/children/1/reports/?page_size=100&tz=Asia%2FSeoul&center_id=1&cls=1&child=1&date_start=2025-08-01&date_end=2025-08-31"
 */
const generateReportURIs = (
  infoPath,
  centerPath,
  pageSize = 9999,
  startDate,
  endDate,
) => {
  const info = loadJson(infoPath);
  const center = loadJson(centerPath);

  const dateStartStr = toDateString(startDate);
  const dateEndStr = toDateString(endDate);

  return info.children.flatMap((child) =>
    center.classes.map(({ id: classId }) => {
      let url = `https://www.kidsnote.com/api/v1_2/children/${child.id}/reports/?page_size=${pageSize}&tz=Asia%2FSeoul&center_id=${center.id}&cls=${classId}&child=${child.id}`;
      if (dateStartStr) url += `&date_start=${dateStartStr}`;
      if (dateEndStr) url += `&date_end=${dateEndStr}`;
      return url;
    }),
  );
};

module.exports = {
  generateReportURIs,
};

/**
 * CLI에서 직접 실행되는 경우 처리
 * 명령줄 인수를 받아 generateReportURIs 함수를 실행하고 결과를 출력합니다.
 *
 * 사용법:
 * node src/reports.js <infoPath> <centerPath> [pageSize] [startDate] [endDate] [--open]
 *
 * 예시:
 * node src/reports.js data/info.json data/centers/1.json
 * node src/reports.js data/info.json data/centers/1.json 100
 * node src/reports.js data/info.json data/centers/1.json 100 2025-08-18
 * node src/reports.js data/info.json data/centers/1.json 100 2025-08-18 2025-08-19
 * node src/reports.js data/info.json data/centers/1.json 100 2025-08-18 2025-08-19 --open
 */
if (require.main === module) {
  const currentFile = path.relative(process.cwd(), __filename);
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      `❌ 사용법: node ${currentFile} <infoPath> <centerPath> [pageSize] [startDate] [endDate] [--open]`,
    );
    console.log("📖 예시:");
    console.log(`  node ${currentFile} data/info.json data/centers/1.json`);
    console.log(`  node ${currentFile} data/info.json data/centers/1.json 100`);
    console.log(
      `  node ${currentFile} data/info.json data/centers/1.json 100 2025-08-18`,
    );
    console.log(
      `  node ${currentFile} data/info.json data/centers/1.json 100 2025-08-18 2025-08-19`,
    );
    console.log(
      `  node ${currentFile} data/info.json data/centers/1.json 100 2025-08-18 2025-08-19 --open`,
    );
    process.exit(1);
  }

  // --open 옵션 확인 및 제거
  const shouldOpen = args.includes("--open");
  const filteredArgs = args.filter((arg) => arg !== "--open");

  const [infoPath, centerPath, pageSize, startDate, endDate] = filteredArgs;

  try {
    const uris = generateReportURIs(
      infoPath,
      centerPath,
      pageSize ? parseInt(pageSize, 10) : undefined,
      startDate,
      endDate,
    );

    console.log(`📊 생성된 URI 개수: ${uris.length}`);
    console.log(`📁 Info: ${infoPath}`);
    console.log(`🏢 Center: ${centerPath}`);
    if (pageSize) console.log(`📄 Page Size: ${pageSize}`);
    if (startDate) console.log(`📅 Start Date: ${startDate}`);
    if (endDate) console.log(`📅 End Date: ${endDate}`);

    console.log("📋 생성된 목록:");

    uris.forEach((uri, index) => {
      console.log(`${index + 1}. ${uri}`);
    });

    // --open 옵션이 있으면 브라우저에서 열기
    if (shouldOpen) {
      console.log("\n🌐 브라우저에서 URI들을 열고 있습니다...");
      console.log(
        "💾 열린 브라우저 저장하기: Ctrl+s (Win/Linux) 또는 Cmd+s (Mac)\n",
      );
      uris.forEach((uri, index) => {
        setTimeout(() => {
          openInBrowser(uri);
        }, index * 1000);
      });
    } else {
      console.log("\n💡 브라우저에서 열려면 --open 옵션을 추가하세요.");
    }
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`);
    process.exit(1);
  }
}
