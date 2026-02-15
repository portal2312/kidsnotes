const { loadJson, openInBrowser } = require("./utils");
const path = require("path");
const { parseArgs } = require("util");
const fs = require("fs");

/**
 * info.json 파일에서 center_id를 추출하여 센터 정보 API URL을 생성합니다
 *
 * @param {string} infoPath - info.json 파일의 경로 (절대/상대 경로 모두 지원)
 * @returns {string[]} 센터 정보 API URL 배열
 * @throws {Error} infoPath가 제공되지 않았거나, 파일이 존재하지 않거나, center_id를 찾을 수 없는 경우
 *
 * @example
 * // 기본 사용법
 * const urls = generateCenterURIs("data/info.json");
 * // → ["https://www.kidsnote.com/api/v1/centers/1"]
 *
 * // 여러 센터가 있는 경우
 * const urls = generateCenterURIs("data/info.json");
 * // → ["https://www.kidsnote.com/api/v1/centers/1", "https://www.kidsnote.com/api/v1/centers/1"]
 */
const generateCenterURIs = (infoPath) => {
  if (!infoPath) {
    throw new Error("infoPath is required");
  }

  const info = loadJson(infoPath);

  // children 배열에서 center_id 추출
  if (!info.children || !Array.isArray(info.children)) {
    throw new Error("Invalid info.json: children array not found");
  }

  // 중복 제거를 위해 Set 사용
  const centerIds = new Set();

  info.children.forEach((child) => {
    // enrollment 배열에서 center_id 추출
    if (child.enrollment && Array.isArray(child.enrollment)) {
      child.enrollment.forEach((enrollment) => {
        if (enrollment.center_id) {
          centerIds.add(enrollment.center_id);
        }
      });
    }
  });

  if (centerIds.size === 0) {
    throw new Error("No center_id found in info.json");
  }

  // center_id로 URL 생성
  return Array.from(centerIds).map(
    (centerId) => `https://www.kidsnote.com/api/v1/centers/${centerId}`,
  );
};

module.exports = {
  generateCenterURIs,
};

function parseReadArgs(args) {
  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        info: { type: "string" },
        open: { type: "boolean" },
      },
      allowPositionals: true,
    });

    return { values, positionals };
  } catch (e) {
    console.error(`❌ 옵션 파싱 오류: ${e.message}`);
    return null;
  }
}

function handleReadCommand(args) {
  const parsed = parseReadArgs(args);
  if (!parsed) return;

  const { values } = parsed;
  const infoPath = values.info;
  const shouldOpen = values.open;

  if (!infoPath) {
    console.error("❌ 오류: --info <path> 옵션은 필수입니다.");
    return;
  }

  try {
    const uris = generateCenterURIs(infoPath);

    console.log(`📊 생성된 센터 URI 개수: ${uris.length}`);
    console.log(`📁 Info: ${infoPath}`);
    console.log("📋 생성된 목록:");

    uris.forEach((uri, index) => {
      console.log(`${index + 1}. ${uri}`);
    });

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

function printUsage() {
  console.log("사용법:");
  console.log("  node src/centers.js <command> [options]");
  console.log("");
  console.log("명령어:");
  console.log("  read      센터 URI 목록을 생성하고 조회합니다.");
  console.log("");
  console.log("예시:");
  console.log("  node src/centers.js read --info data/info.json --open");
}

/**
 * CLI에서 직접 실행되는 경우 처리
 * 명령줄 인수를 받아 명령어를 실행합니다.
 *
 * 사용법:
 * node src/centers.js <command> [options]
 *
 * 명령어:
 * 1. read: 센터 URI 목록을 생성하고 조회합니다.
 *    node src/centers.js read --info <infoPath> [--open]
 *
 * 예시:
 * node src/centers.js read --info data/info.json
 * node src/centers.js read --info data/info.json --open
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "read":
      handleReadCommand(commandArgs);
      break;
    default:
      console.error(`❌ 알 수 없는 명령어: ${command}`);
      printUsage();
      process.exit(1);
  }
}
