#!/usr/bin/env bash
set -euo pipefail

# Mongo backup script
# - Dumps the database using mongodump
# - Compresses to a timestamped archive
# - Keeps local copies for N days (prune)
# - Optionally uploads to Cloudflare R2/S3 if AWS-style envs are present
#
# Requirements on the server:
# - mongodump (from MongoDB Database Tools)
# - tar, gzip
# - (optional) awscli v2 configured for R2 endpoint if UPLOAD_TO_R2=true
#
# Usage:
#   chmod +x scripts/backup-mongo.sh
#   MONGODB_URI="mongodb+srv://..." \
#   BACKUP_DIR="/var/backups/mcinv" \
#   RETAIN_DAYS=7 \
#   ./scripts/backup-mongo.sh
#
# Optional R2 upload:
#   UPLOAD_TO_R2=true \
#   R2_BUCKET="your-bucket" \
#   R2_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com" \
#   AWS_ACCESS_KEY_ID=... \
#   AWS_SECRET_ACCESS_KEY=... \
#   R2_PREFIX="mongo-backups" \
#   ./scripts/backup-mongo.sh

: "${MONGODB_URI:?MONGODB_URI is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mcinv}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
WORKDIR="${BACKUP_DIR}/${TIMESTAMP}"
ARCHIVE_PATH="${BACKUP_DIR}/mongo-${TIMESTAMP}.tar.gz"

mkdir -p "${WORKDIR}"
echo "[backup] Dumping MongoDB to ${WORKDIR}"

mongodump --uri="${MONGODB_URI}" --out="${WORKDIR}"

echo "[backup] Creating archive ${ARCHIVE_PATH}"

tar -C "${WORKDIR}" -czf "${ARCHIVE_PATH}" .

# Clean working dir
rm -rf "${WORKDIR}"

echo "[backup] Pruning local archives older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}" -type f -name 'mongo-*.tar.gz' -mtime +"${RETAIN_DAYS}" -delete || true

if [[ "${UPLOAD_TO_R2:-false}" == "true" ]]; then
  : "${R2_BUCKET:?R2_BUCKET required when UPLOAD_TO_R2=true}"
  : "${R2_ENDPOINT:?R2_ENDPOINT required when UPLOAD_TO_R2=true}"
  : "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID required when UPLOAD_TO_R2=true}"
  : "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY required when UPLOAD_TO_R2=true}"
  KEY_PREFIX="${R2_PREFIX:-mongo-backups}"
  DEST="s3://${R2_BUCKET}/${KEY_PREFIX}/$(basename "${ARCHIVE_PATH}")"
  echo "[backup] Uploading to R2: ${DEST}"
  aws --endpoint-url "${R2_ENDPOINT}" s3 cp "${ARCHIVE_PATH}" "${DEST}"
fi

echo "[backup] Done: ${ARCHIVE_PATH}"
