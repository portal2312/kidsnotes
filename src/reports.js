const { loadJson, toDateString, openInBrowser } = require("./utils");
const path = require("path");
const { parseArgs } = require("util");

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
 * 명령줄 인수를 받아 알림장 URI 생성, 리포트 병합, 사진/영상 다운로드 등의 작업을 수행합니다.
 *
 * 사용법:
 * node src/reports.js <command> [options]
 *
 * 명령어:
 * 1. read: 알림장 URI 생성
 *    node src/reports.js read --info <infoPath> --center <centerPath> [pageSize] [startDate] [endDate] [--open]
 *
 * 2. merge: 리포트 JSON 병합
 *    node src/reports.js merge <file1> <file2> ... --save <outputFile>
 *
 * 3. download: 사진/영상 다운로드
 *    node src/reports.js download <jsonFilePath> [downloadPath]
 */
if (require.main === module) {
  const currentFile = path.relative(process.cwd(), __filename);
  const args = process.argv.slice(2);

  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        info: { type: "string" },
        center: { type: "string" },
        open: { type: "boolean" },
        save: { type: "string" },
      },
      allowPositionals: true,
    });

    if (positionals.length === 0) {
      printUsage(currentFile);
      process.exit(1);
    }

    const command = positionals[0];

    switch (command) {
      case "read": {
        if (!values.info || !values.center) {
          console.error(
            "❌ 오류: read 명령에는 --info와 --center 옵션이 반드시 필요합니다.",
          );
          process.exit(1);
        }

        // positionals: [command, pageSize, startDate, endDate]
        const pageSize = positionals[1];
        const startDate = positionals[2];
        const endDate = positionals[3];

        handleReadCommand(
          values.info,
          values.center,
          pageSize ? parseInt(pageSize, 10) : undefined,
          startDate,
          endDate,
          values.open || false,
        );
        break;
      }
      case "merge": {
        if (!values.save) {
          console.error(
            "❌ 오류: merge 명령에는 --save <outputFile> 옵션이 반드시 필요합니다.",
          );
          process.exit(1);
        }

        // positionals: [command, file1, file2, ...]
        const inputFiles = positionals.slice(1);

        if (inputFiles.length === 0) {
          console.error("❌ 오류: 병합할 입력 파일이 지정되지 않았습니다.");
          process.exit(1);
        }

        handleMergeCommand(inputFiles, values.save);
        break;
      }
      case "download": {
        // positionals: [command, jsonFilePath, downloadPath]
        if (positionals.length < 2) {
          console.error(
            "❌ 오류: download 명령에는 <jsonFilePath>가 반드시 필요합니다.",
          );
          process.exit(1);
        }

        const jsonFilePath = path.resolve(process.cwd(), positionals[1]);
        let downloadPath;

        if (positionals.length > 2) {
          downloadPath = path.resolve(process.cwd(), positionals[2]);
        } else {
          downloadPath = path.resolve(process.cwd(), "pictures/current");
        }

        handleDownloadCommand(jsonFilePath, downloadPath);
        break;
      }
      default:
        console.error(`❌ 오류: 알 수 없는 명령어 '${command}' 입니다.`);
        printUsage(currentFile);
        process.exit(1);
    }
  } catch (err) {
    if (err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      console.error(`❌ 오류: 알 수 없는 옵션입니다. (${err.message})`);
    } else {
      console.error(
        `❌ 오류: 인자 파싱 중 문제가 발생했습니다. (${err.message})`,
      );
    }
    process.exit(1);
  }
}

function handleMergeCommand(inputFiles, outputFile) {

  try {
    const fs = require("fs");
    // 첫 번째 파일을 기본 객체로 로드
    const baseData = loadJson(inputFiles[0]);

    if (!baseData.results || !Array.isArray(baseData.results)) {
      console.error(
        `❌ 오류: 첫 번째 파일(${inputFiles[0]})에 유효한 results 배열이 없습니다.`,
      );
      process.exit(1);
    }

    // 나머지 파일들의 results 병합
    for (let i = 1; i < inputFiles.length; i++) {
      const filePath = inputFiles[i];
      const data = loadJson(filePath);

      if (data.results && Array.isArray(data.results)) {
        baseData.results.push(...data.results);
      } else {
        console.warn(
          `⚠️ 경고: ${filePath} 파일에 results 배열이 없어 건너뜁니다.`,
        );
      }
    }

    // 결과 저장
    fs.writeFileSync(outputFile, JSON.stringify(baseData, null, 2), "utf8");
    // 성공 시 출력 없음 (요청사항)
    process.exit(0);
  } catch (error) {
    console.error(`❌ 병합 중 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

function handleReadCommand(
  infoPath,
  centerPath,
  pageSize,
  startDate,
  endDate,
  shouldOpen,
) {
  try {
    const uris = generateReportURIs(
      infoPath,
      centerPath,
      pageSize,
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

function handleDownloadCommand(jsonFilePath, downloadPath) {
  const { downloads } = require("./downloads");

  try {
    if (!require("fs").existsSync(jsonFilePath)) {
      console.error(`❌ 파일을 찾을 수 없습니다: ${jsonFilePath}`);
      process.exit(1);
    }

    const data = loadJson(jsonFilePath);
    console.log(`📁 JSON 파일 로드: ${jsonFilePath}`);
    console.log(`📁 다운로드 경로: ${downloadPath}`);

    downloads(data, downloadPath, 10)
      .then(() => {
        console.log("✅ 다운로드 작업 완료");
        process.exit(0);
      })
      .catch((error) => {
        console.error(`❌ 다운로드 중 오류 발생: ${error.message}`);
        process.exit(1);
      });
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

function printUsage(currentFile) {
  console.log(`❌ 사용법: node ${currentFile} <command> [options]`);
  console.log("\n1️⃣  URIs 생성 (read):");
  console.log(
    `   node ${currentFile} read --info <infoPath> --center <centerPath> [pageSize] [startDate] [endDate] [--open]`,
  );
  console.log(
    `   예시: node ${currentFile} read --info data/info.json --center data/centers/1.json 100 --open`,
  );
  console.log("\n2️⃣  JSON 병합 (merge):");
  console.log(
    `   node ${currentFile} merge <file1> <file2> ... --save <outputFile>`,
  );
  console.log(
    `   예시: node ${currentFile} merge file1.json file2.json --save merged.json`,
  );
  console.log("\n3️⃣  사진/영상 다운로드 (download):");
  console.log(
    `   node ${currentFile} download <jsonFilePath> [downloadPath]`,
  );
  console.log(
    `   예시: node ${currentFile} download data/reports/current.json pictures/2026`,
  );
}
