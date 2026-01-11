/**
 * 사용법: node src/sync_date_from_filename.js <파일_또는_디렉터리_경로>
 *
 * 이 스크립트는 파일 이름을 기반으로 파일의 생성 일자와 수정 일자를 변경합니다.
 * 예상 파일 이름 형식: {YYYYMMDD}-{HHmmss}-{file id}.{extension}
 * 예: 20240304-080423-5279066601.jpg
 *
 * 기능:
 * - macOS의 'SetFile' 명령어를 사용합니다.
 * - 디렉터리 처리 시 'worker_threads'를 사용하여 병렬 처리합니다.
 * - 진행률 표시줄(Progress Bar)을 표시합니다.
 * - 이미 날짜가 동기화된 파일은 건너뛰고 목록에 표시합니다.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const os = require("os");
const readline = require("readline");

// 정규식 매칭: {YYYYMMDD}-{HHmmss}-{file id}.{extension}
const FILENAME_REGEX = /^(\d{8})-(\d{6})-(.+)\.([a-zA-Z0-9]+)$/;

/**
 * 날짜 객체를 'YYYY-MM-DD HH:mm:ss' 형식의 문자열로 변환합니다.
 */
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const MM = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${ss}`;
}

/**
 * 단일 파일의 날짜를 업데이트합니다. (Worker에서도 사용됨)
 */
function updateFileDates(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(FILENAME_REGEX);

  if (!match) {
    return { success: false, reason: "형식 불일치" };
  }

  // 현재 파일의 상태(기존 날짜)를 가져옵니다.
  let oldStat;
  try {
    oldStat = fs.statSync(filePath);
  } catch (error) {
    return { success: false, reason: `파일 정보 읽기 실패: ${error.message}` };
  }

  const datePart = match[1]; // YYYYMMDD
  const timePart = match[2]; // HHmmss

  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);
  const hour = timePart.substring(0, 2);
  const minute = timePart.substring(2, 4);
  const second = timePart.substring(4, 6);

  // SetFile 명령어용 날짜 형식: "MM/DD/YYYY HH:mm:ss"
  const setFileDateString = `${month}/${day}/${year} ${hour}:${minute}:${second}`;

  // 출력용 변경 후 날짜 형식: "YYYY-MM-DD HH:mm:ss"
  const newDateFormatted = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

  // === 이미 날짜가 일치하는지 확인 ===
  const currentBirth = formatDate(oldStat.birthtime);
  const currentMtime = formatDate(oldStat.mtime);

  if (currentBirth === newDateFormatted && currentMtime === newDateFormatted) {
    return { success: false, reason: "이미 동기화 됨", skipped: true };
  }

  try {
    // -d: 생성 일자 (Creation Date / Birth)
    // -m: 수정 일자 (Modification Date)
    execSync(
      `SetFile -d "${setFileDateString}" -m "${setFileDateString}" "${filePath}"`,
      { stdio: "ignore" },
    );

    return {
      success: true,
      oldBirth: currentBirth,
      oldMtime: currentMtime,
      newDate: newDateFormatted,
    };
  } catch (error) {
    return { success: false, reason: `명령어 실행 오류: ${error.message}` };
  }
}

// ==========================================
// 메인 스레드 로직
// ==========================================
if (isMainThread) {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error("❌ 오류: 파일이나 디렉터리 경로를 인자로 제공해 주세요.");
    process.exit(1);
  }

  try {
    const stats = fs.statSync(targetPath);

    if (stats.isFile()) {
      // === 단일 파일 처리 (메인 스레드에서 직접 처리) ===
      const result = updateFileDates(targetPath);
      const filename = path.basename(targetPath);

      if (result.success) {
        console.log(`📄 파일 명: ${filename}`);
        console.log(`- 📅 생성 일자: ${result.oldBirth} → ${result.newDate}`);
        console.log(`- 📝 변경 일자: ${result.oldMtime} → ${result.newDate}`);
      } else if (result.skipped) {
        console.log(`⏭️  건너뜀: ${filename} (이미 동기화 됨)`);
      } else {
        console.log(`❌ 실패: ${filename} (${result.reason})`);
      }
    } else if (stats.isDirectory()) {
      // === 디렉터리 처리 (멀티 스레드) ===
      console.log(`📂 디렉터리 분석 중: ${targetPath} ...`);

      // 1. 모든 파일 목록 수집
      const allFiles = getAllFiles(targetPath);
      const totalFiles = allFiles.length;

      if (totalFiles === 0) {
        console.log("⚠️ 처리할 파일이 없습니다.");
        process.exit(0);
      }

      console.log(
        `🚀 총 ${totalFiles}개의 파일을 발견했습니다. 병렬 처리를 시작합니다...`,
      );

      // 2. 워커 스레드 준비
      const numCPUs = os.cpus().length;
      const numWorkers = Math.min(numCPUs, totalFiles);
      const fileChunks = chunkArray(allFiles, numWorkers);

      let completed = 0;
      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;
      const failList = [];

      // 진행률 표시 바 업데이트 함수
      const updateProgressBar = () => {
        const percentage = Math.floor((completed / totalFiles) * 100);
        const barLength = 30;
        const filledLength = Math.floor((barLength * percentage) / 100);
        const bar =
          "█".repeat(filledLength) + "-".repeat(barLength - filledLength);

        readline.cursorTo(process.stdout, 0);
        process.stdout.write(
          `[${bar}] ${percentage}% (${completed}/${totalFiles})`,
        );
      };

      updateProgressBar(); // 초기 0% 표시

      // 워커 생성 및 실행
      let workersFinished = 0;

      for (let i = 0; i < numWorkers; i++) {
        if (fileChunks[i].length === 0) {
          workersFinished++;
          continue;
        }

        const worker = new Worker(__filename, {
          workerData: { files: fileChunks[i] },
        });

        worker.on("message", (message) => {
          // 워커로부터 결과 수신
          completed++;
          if (message.success) {
            successCount++;
          } else {
            // 실패 또는 건너뜀
            if (message.skipped) {
              skipCount++;
            } else {
              failCount++;
            }

            // 사용자의 요청대로 무시된 파일도 실패 목록처럼 출력되게 리스트에 추가
            failList.push(message);
          }
          updateProgressBar();
        });

        worker.on("error", (err) => {
          console.error(`\n❌ 워커 에러: ${err.message}`);
        });

        worker.on("exit", (code) => {
          workersFinished++;
          if (workersFinished === numWorkers) {
            // 모든 워커 종료 시 최종 결과 출력
            process.stdout.write("\n"); // 줄 바꿈
            if (failList.length > 0) {
              console.log("\n--- ❌ 실패 또는 건너뛴 파일 목록 ---");
              failList.forEach((item) => {
                const mark = item.skipped ? "⏭️" : "❌";
                console.log(`- ${mark} ${item.filename} (${item.reason})`);
              });
            }

            console.log("\n--- 📊 요약 ---");
            console.log(`총 파일 수 : ${totalFiles}`);
            console.log(`✅ 성공    : ${successCount}`);
            console.log(`⏭️  건너뜀  : ${skipCount}`);
            console.log(`❌ 실패    : ${failCount}`);
          }
        });
      }
    } else {
      console.error("❌ 오류: 경로가 파일이나 디렉터리가 아닙니다.");
    }
  } catch (error) {
    console.error(`❌ 오류: ${error.message}`);
    process.exit(1);
  }
}
// ==========================================
// 워커 스레드 로직
// ==========================================
else {
  const { files } = workerData;

  files.forEach((filePath) => {
    const result = updateFileDates(filePath);
    parentPort.postMessage({
      success: result.success,
      reason: result.reason,
      skipped: result.skipped,
      filename: path.basename(filePath),
    });
  });
}

// 헬퍼 함수: 디렉터리 재귀 탐색
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      // 숨김 파일 제외
      if (!file.startsWith(".")) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });

  return arrayOfFiles;
}

// 헬퍼 함수: 배열 쪼개기
function chunkArray(array, parts) {
  const result = [];
  for (let i = 0; i < parts; i++) {
    result.push([]);
  }
  for (let i = 0; i < array.length; i++) {
    result[i % parts].push(array[i]);
  }
  return result;
}
