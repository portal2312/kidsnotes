// utils에서 공통 함수들을 가져옵니다
const { loadJson, toDateString, openInBrowser } = require("./utils");
const path = require("path");

/**
 * 키즈노트 공지사항 API URI들을 생성합니다
 *
 * JSON 파일로부터 자녀 정보와 센터 정보를 동적으로 로드하여
 * 키즈노트 공지사항 API 호출을 위한 URI들을 생성합니다.
 * 날짜 필터링과 페이지 크기 설정을 지원합니다.
 *
 * @param {string} infoPath - 자녀 정보가 담긴 info.json 파일 경로 (절대/상대 경로 모두 지원)
 * @param {string} centerPath - 센터 정보가 담긴 center.json 파일 경로 (절대/상대 경로 모두 지원)
 * @param {number} [pageSize=20] - 페이지당 아이템 수 (기본값: 20)
 * @param {string|Date} [date] - 조회할 날짜 (YYYY-MM-DD 문자열 또는 Date 객체, 선택사항)
 * @returns {string[]} 생성된 API URI 배열
 *
 * @example
 * // 기본 사용법 (날짜 필터 없음, 현재 실행 경로 기준)
 * const uris = generateNoticeURIs("data/info.json", "data/centers/48652.json");
 *
 * // 페이지 크기 지정
 * const uris = generateNoticeURIs("data/info.json", "data/centers/48652.json", 20);
 *
 * // 특정 날짜로 필터링
 * const uris = generateNoticeURIs(
 *   "data/info.json",
 *   "data/centers/48652.json",
 *   20,
 *   "2025-09-07"
 * );
 *
 * // Date 객체 사용
 * const uris = generateNoticeURIs(
 *   "data/info.json",
 *   "data/centers/48652.json",
 *   20,
 *   new Date("2025-09-07")
 * );
 *
 * // 생성되는 URI 형태:
 * // "https://www.kidsnote.com/api/v1/centers/48652/notices?cls=363708&date=2025-09-07&tz=Asia%2FSeoul&page_size=20"
 */
const generateNoticeURIs = (infoPath, centerPath, pageSize = 9999, date) => {
  const info = loadJson(infoPath);
  const center = loadJson(centerPath);

  const dateStr = toDateString(date) || toDateString(new Date());

  return info.children.flatMap((child) =>
    child.enrollment
      .filter((enrollment) => enrollment.center_id === center.id)
      .map((enrollment) => {
        let url = `https://www.kidsnote.com/api/v1/centers/${center.id}/notices?cls=${enrollment.belong_to_class}&tz=Asia%2FSeoul&page_size=${pageSize}`;
        if (dateStr) url += `&date=${dateStr}`;
        return url;
      }),
  );
};

module.exports = {
  generateNoticeURIs,
};

/**
 * CLI에서 직접 실행되는 경우 처리
 * 명령줄 인수를 받아 generateNoticeURIs 함수를 실행하고 결과를 출력합니다.
 *
 * 사용법:
 * node src/notices.js <infoPath> <centerPath> [pageSize] [date] [--open]
 *
 * 예시:
 * node src/notices.js data/info.json data/centers/48652.json
 * node src/notices.js data/info.json data/centers/48652.json 20
 * node src/notices.js data/info.json data/centers/48652.json 20 2025-09-07
 * node src/notices.js data/info.json data/centers/48652.json 20 2025-09-07 --open
 */
if (require.main === module) {
  const currentFile = path.relative(process.cwd(), __filename);
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      `❌ 사용법: node ${currentFile} <infoPath> <centerPath> [pageSize] [date] [--open]`,
    );
    console.log("📖 예시:");
    console.log(`  node ${currentFile} data/info.json data/centers/48652.json`);
    console.log(
      `  node ${currentFile} data/info.json data/centers/48652.json 20`,
    );
    console.log(
      `  node ${currentFile} data/info.json data/centers/48652.json 20 2025-09-07`,
    );
    console.log(
      `  node ${currentFile} data/info.json data/centers/48652.json 20 2025-09-07 --open`,
    );
    process.exit(1);
  }

  // --open 옵션 확인 및 제거
  const shouldOpen = args.includes("--open");
  const filteredArgs = args.filter((arg) => arg !== "--open");

  const [infoPath, centerPath, pageSize, date] = filteredArgs;

  try {
    const uris = generateNoticeURIs(
      infoPath,
      centerPath,
      pageSize ? parseInt(pageSize, 10) : undefined,
      date,
    );

    console.log(`📊 생성된 URI 개수: ${uris.length}`);
    console.log(`📁 Info: ${infoPath}`);
    console.log(`🏢 Center: ${centerPath}`);
    if (pageSize) console.log(`📄 Page Size: ${pageSize}`);
    if (date) console.log(`📅 Date: ${date}`);

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
