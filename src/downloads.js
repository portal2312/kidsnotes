const fs = require("fs");
const https = require("https");
const path = require("path");

// 기존 require 방식 대신 동적 로드로 변경
let data;
let downloadPath; // 다운로드 경로를 저장할 전역 변수

const {
  loadJson,
  generateFilename,
  ensureDirectory,
  isValidFile,
  isValidUrl,
  sleep,
  formatFileSize,
  chunkArray,
  formatDuration,
} = require("./utils");

// 다운로드 통계 - 전역적으로 다운로드 진행 상황을 추적
let stats = {
  total: 0, // 전체 다운로드할 파일 수
  downloaded: 0, // 성공적으로 다운로드된 파일 수
  skipped: 0, // 이미 존재하여 건너뛴 파일 수
  failed: 0, // 다운로드 실패한 파일 수
};

/**
 * 단일 파일 다운로드 함수
 *
 * @param {string} url - 다운로드할 이미지의 원본 URL
 * @param {string} filename - 저장할 파일명
 * @param {number} retries - 실패 시 재시도 횟수 (기본값: 3)
 * @returns {Promise<Object>} 다운로드 결과 객체 {status, filePath, filename, size?}
 *
 * 주요 기능:
 * - 중복 다운로드 방지 (파일 존재 및 크기 검사)
 * - URL 유효성 검증
 * - HTTP 상태코드 검사
 * - 파일 크기 검증 (100바이트 미만 거부)
 * - 재시도 로직 (네트워크 오류 시)
 * - 타임아웃 처리 (30초)
 * - 안전한 파일 정리 (실패 시)
 */
const download = (url, filename, retries = 3) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(downloadPath, filename);

    // 중복 다운로드 방지: 파일이 이미 존재하고 유효한 크기를 가지면 건너뛰기
    if (isValidFile(filePath, 100)) {
      console.log(`⏭️  ${filename} 이미 존재합니다. 건너뛰기`);
      stats.skipped++;
      return resolve({ status: "skipped", filePath, filename });
    }

    // URL 유효성 검사: HTTPS 프로토콜만 허용
    if (!isValidUrl(url)) {
      return reject(new Error(`Invalid URL: ${url}`));
    }

    // 파일 스트림 생성 및 다운로드 크기 추적 변수
    const fileStream = fs.createWriteStream(filePath);
    let downloadSize = 0;

    // HTTPS GET 요청 시작
    const request = https.get(url, (response) => {
      const { statusCode, headers } = response;
      const contentLength = parseInt(headers["content-length"] || 0);

      // HTTP 상태코드 검사: 200이 아니면 오류 처리
      if (statusCode !== 200) {
        fileStream.close(() => fs.unlink(filePath, () => {}));
        return reject(new Error(`HTTP ${statusCode}: ${filename}`));
      }

      // 파일 크기 사전 검증: Content-Length가 너무 작으면 오류 처리
      if (contentLength > 0 && contentLength < 100) {
        fileStream.close(() => fs.unlink(filePath, () => {}));
        return reject(
          new Error(`File too small: ${filename} (${contentLength} bytes)`),
        );
      }

      // 데이터 청크 수신 시 크기 누적
      response.on("data", (chunk) => {
        downloadSize += chunk.length;
      });

      // 응답 스트림을 파일 스트림으로 파이프
      response.pipe(fileStream);

      // 파일 쓰기 완료 이벤트 처리
      fileStream.on("finish", () => {
        fileStream.close(() => {
          // 실제로 다운로드된 데이터가 있는지 확인
          if (downloadSize > 0) {
            console.log(
              `✅ Downloaded: ${filename} (${formatFileSize(downloadSize)})`,
            );
            stats.downloaded++;
            resolve({
              status: "downloaded",
              filePath,
              filename,
              size: downloadSize,
            });
          } else {
            // 빈 파일이면 삭제 후 오류 처리
            fs.unlink(filePath, () => {});
            reject(new Error(`Empty file downloaded: ${filename}`));
          }
        });
      });
    });

    // 네트워크 오류 처리 및 재시도 로직
    request.on("error", (err) => {
      fileStream.close(() => fs.unlink(filePath, () => {}));

      // 재시도 횟수가 남아있으면 2초 후 재시도
      if (retries > 0) {
        console.log(
          `⚠️  ${filename} 다운로드 실패, ${retries}번 재시도합니다...`,
        );
        setTimeout(() => {
          download(url, filename, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 2000);
      } else {
        reject(new Error(`Download failed after retries: ${err.message}`));
      }
    });

    // 타임아웃 설정: 30초 초과 시 요청 중단
    request.setTimeout(30000, () => {
      request.destroy();
      fileStream.close(() => fs.unlink(filePath, () => {}));
      reject(new Error(`Timeout downloading: ${filename}`));
    });
  });
};

/**
 * 배치 단위로 병렬 다운로드를 처리하는 함수
 *
 * @param {Array} batch - 다운로드할 파일 정보 배열 [{url, filename}, ...]
 * @param {number} batchIndex - 현재 배치의 인덱스 (0부터 시작)
 * @param {number} totalBatches - 전체 배치 수
 * @returns {Promise<Array>} Promise.allSettled의 결과 배열
 *
 * 주요 기능:
 * - 배치 내 파일들을 동시에 병렬 다운로드
 * - Promise.allSettled 사용으로 일부 실패해도 전체 중단되지 않음
 * - 실시간 진행률 표시
 * - 각 다운로드 결과를 개별적으로 처리
 */
const downloadBatch = async (batch, batchIndex, totalBatches) => {
  console.log(
    `🚀 배치 ${batchIndex + 1}/${totalBatches} 시작 (${batch.length}개 파일)`,
  );

  // 배치 내 모든 파일을 병렬로 다운로드 시작
  const promises = batch.map(async ({ url, filename }) => {
    try {
      const result = await download(url, filename);
      return { success: true, filename, result };
    } catch (error) {
      console.error(`❌ Error downloading ${filename}: ${error.message}`);
      stats.failed++;
      return { success: false, filename, error: error.message };
    }
  });

  // 모든 다운로드가 완료될 때까지 대기 (실패해도 전체는 계속)
  const results = await Promise.allSettled(promises);

  // 현재까지의 전체 진행상황 계산 및 출력
  const processed = stats.downloaded + stats.failed + stats.skipped;
  console.log(
    `📊 배치 ${batchIndex + 1} 완료 - 진행률: ${processed}/${
      stats.total
    } (${Math.round((processed / stats.total) * 100)}%)`,
  );

  return results;
};

/**
 * 모든 이미지와 비디오를 병렬로 다운로드하는 메인 함수
 *
 * @param {number} concurrency - 동시 다운로드 수 (기본값: 10)
 *
 * 처리 과정:
 * 1. 출력 디렉토리 생성
 * 2. JSON 데이터에서 이미지 및 비디오 URL과 메타데이터 추출
 * 3. 파일명 생성 및 다운로드 목록 구성
 * 4. 지정된 동시성으로 배치 단위 병렬 처리
 * 5. 배치 간 지연으로 서버 부하 방지
 *
 * 성능 최적화:
 * - 배치 기반 병렬 처리로 메모리 사용량 제어
 * - 서버 부하 방지를 위한 배치 간 1초 대기
 * - 중복 다운로드 방지로 대역폭 절약
 */
const downloads = async (data, downloadPath, concurrency = 10) => {
  console.log("🚀 파일 다운로드를 시작합니다...");

  // 출력 디렉토리 생성 (없으면 생성, 있으면 무시)
  ensureDirectory(downloadPath);

  // 1단계: JSON 데이터에서 다운로드 대상 이미지 및 비디오 목록 수집
  const downloadList = [];

  for (const entry of data.results) {
    const {
      created: createdAt,
      attached_images: images,
      attached_video: video,
    } = entry;

    // 이미지가 첨부된 엔트리 처리
    if (images && images.length > 0) {
      for (const image of images) {
        const { id, original } = image;

        // URL이 없는 이미지는 건너뛰고 경고 출력
        if (!original) {
          console.warn(`⚠️  이미지 URL이 없습니다: ID ${id}`);
          continue;
        }

        // 생성일시와 ID를 조합하여 고유한 파일명 생성
        const filename = generateFilename(
          createdAt,
          id,
          path.extname(original) || ".jpg", // 확장자가 없으면 .jpg 기본값
        );

        downloadList.push({ url: original, filename });
      }
    }

    // 비디오가 첨부된 엔트리 처리
    if (video && video.high) {
      const { id, high } = video;

      // URL이 없는 비디오는 건너뛰고 경고 출력
      if (!high) {
        console.warn(`⚠️  비디오 URL이 없습니다: ID ${id}`);
        continue;
      }

      // 생성일시와 ID를 조합하여 고유한 파일명 생성
      const filename = generateFilename(
        createdAt,
        id,
        path.extname(high) || ".mp4", // 확장자가 없으면 .mp4 기본값
      );

      downloadList.push({ url: high, filename });
    }
  }

  // 2단계: 통계 초기화 및 배치 구성
  stats.total = downloadList.length;
  console.log(
    `📊 총 ${stats.total}개의 파일(이미지/비디오)을 ${concurrency}개씩 병렬로 다운로드합니다.`,
  );

  // 전역 변수 설정 (download 함수에서 사용)
  // 주의: downloadPath는 전역 변수가 아닌 인자로 전달받은 값을 사용해야 하지만,
  // download 함수가 전역 변수를 참조하므로 여기서 설정해줍니다.
  // 더 좋은 방법은 download 함수에도 path를 인자로 전달하는 것이지만, 최소한의 변경을 위해 이렇게 처리합니다.
  // 다만, 이 파일의 전역 변수 downloadPath에 값을 할당해야 합니다.
  require("./downloads").setDownloadPath(downloadPath);

  // 동시성 제어를 위해 전체 목록을 지정된 크기의 배치로 분할
  const batches = chunkArray(downloadList, concurrency);
  console.log(`📦 총 ${batches.length}개 배치로 나누어 처리합니다.`);

  // 3단계: 각 배치를 순차적으로 처리 (배치 내에서는 병렬)
  for (let i = 0; i < batches.length; i++) {
    await downloadBatch(batches[i], i, batches.length);

    // 마지막 배치가 아니면 서버 부하 방지를 위해 1초 대기
    if (i < batches.length - 1) {
      await sleep(1000);
    }
  }
};

// 전역 변수 설정을 위한 헬퍼 함수
const setDownloadPath = (path) => {
  downloadPath = path;
};

// 모듈로 사용될 때를 위한 exports
module.exports = {
  downloads,
  download,
  downloadBatch,
  setDownloadPath,
};

/**
 * CLI에서 직접 실행되는 경우 처리
 * 명령줄 인수를 받아 이미지 다운로드 프로세스를 실행합니다.
 *
 * 사용법:
 * node src/downloads.js <jsonFilePath> [downloadPath]
 *
 * 예시:
 * node src/downloads.js data/reports/current.json
 * node src/downloads.js data/reports/2024.json pictures/2024
 */
if (require.main === module) {
  const startTime = Date.now();

  // 명령줄 인수 파싱
  const args = process.argv.slice(2);
  const defaultDownloadPath = "pictures/current";
  const currentFile = path.relative(process.cwd(), __filename);

  // 도움말 표시
  if (args.length === 0) {
    console.log(
      `❌ 사용법: node ${currentFile} <JSON 파일 경로> [다운로드 경로]`,
    );
    console.log("📖 예시:");
    console.log(
      `  ${currentFile} data/reports/current.json (기본 경로: ${defaultDownloadPath})`,
    );
    process.exit(1);
  }

  // 경로 설정
  const jsonFilePath = path.isAbsolute(args[0])
    ? args[0]
    : path.resolve(process.cwd(), args[0]);

  const targetPath = args[1]
    ? path.isAbsolute(args[1])
      ? args[1]
      : path.resolve(process.cwd(), args[1])
    : path.resolve(process.cwd(), defaultDownloadPath);

  // JSON 파일 존재 여부 확인
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${jsonFilePath}`);
    process.exit(1);
  }

  // 데이터 로드 및 정보 출력
  try {
    data = loadJson(jsonFilePath);
    console.log(`📁 JSON 파일 로드: ${jsonFilePath}`);
    console.log(`📁 다운로드 경로: ${targetPath}`);
    console.log(`📊 리포트 개수: ${data.results ? data.results.length : 0}개`);
  } catch (error) {
    console.error(`❌ JSON 파일 로드 실패: ${error.message}`);
    process.exit(1);
  }

  // 다운로드 실행
  downloads(data, targetPath, 10)
    .then(() => {
      // 성공 통계 출력
      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log("\n🎉 다운로드 완료!");
      console.log(`⏱️  소요 시간: ${formatDuration(duration)}`);
      console.log(`📊 통계:`);
      console.log(`   - 총 파일: ${stats.total}개`);
      console.log(`   - 다운로드: ${stats.downloaded}개`);
      console.log(`   - 건너뜀: ${stats.skipped}개 (이미 존재)`);
      console.log(`   - 실패: ${stats.failed}개`);

      if (duration > 0) {
        console.log(
          `📈 평균 속도: ${Math.round(stats.downloaded / duration)} 파일/초`,
        );
      }
    })
    .catch((error) => {
      // 실패 시 에러 출력
      console.error(`💥 다운로드 중 치명적 오류: ${error.message}`);
      console.error(
        `📊 실패 시점 통계: ${stats.downloaded}/${stats.total} 완료`,
      );
      process.exit(1);
    });
}
