#!/usr/bin/env bash
#
# 이유 앱 테이블만 전용 DB(새 Supabase 프로젝트)로 이관.
# 학교 시간표/예약 등 무관한 앱 테이블은 가져오지 않는다.
#
# 사용법:
#   1) 새 Supabase 프로젝트 생성 → Connection string(다이렉트, 5432) 확보
#   2) 환경변수 설정 후 실행:
#        export SOURCE_DATABASE_URL='postgresql://...(현재 공유 DB)'
#        export TARGET_DATABASE_URL='postgresql://...(새 전용 DB)'
#        bash script/db-migration/migrate.sh
#
# 주의:
#   - pg_dump/psql(클라이언트) 버전이 서버(Postgres) major 버전 이상이어야 한다.
#     macOS: `brew install libpq && brew link --force libpq` (또는 postgresql@16/17)
#   - 데이터는 추가(restore)만 한다. TARGET은 비어 있는 새 DB를 권장.
#   - --section 분리: 먼저 스키마+데이터(pre-data/data) → 마지막에 인덱스/제약(post-data).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TABLES_FILE="$HERE/app-tables.txt"
DUMP_FILE="${DUMP_FILE:-$HERE/iyu-app-dump.sql}"

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL 환경변수가 필요합니다}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL 환경변수가 필요합니다}"

# 주석/빈 줄 제거 후 -t 인자 배열 구성
TABLE_ARGS=()
while IFS= read -r line; do
  line="$(echo "$line" | sed -E 's/#.*$//; s/[[:space:]]+//g')"
  [ -z "$line" ] && continue
  TABLE_ARGS+=( -t "public.$line" )
done < "$TABLES_FILE"

echo "▶ 대상 테이블 $(( ${#TABLE_ARGS[@]} / 2 ))개를 덤프합니다..."
echo "  pg_dump 버전: $(pg_dump --version)"

pg_dump "$SOURCE_DATABASE_URL" \
  --no-owner --no-privileges --no-comments \
  --quote-all-identifiers \
  "${TABLE_ARGS[@]}" \
  -f "$DUMP_FILE"

echo "✔ 덤프 완료: $DUMP_FILE ($(wc -l < "$DUMP_FILE") lines)"
echo "▶ 새 DB로 복원합니다..."

# ON_ERROR_STOP=1 로 첫 에러에서 중단(부분 복원 방지)
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

echo "✔ 복원 완료."
echo "다음: 'tsx script/db-migration/verify.ts' 로 행 수를 대조한 뒤 DATABASE_URL을 새 DB로 교체하세요."
