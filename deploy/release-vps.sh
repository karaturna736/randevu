#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Bu betik root olarak çalıştırılmalıdır." >&2
  exit 1
fi
if [[ $# -ne 2 ]]; then
  echo "Kullanım: $0 <release.tar.gz> <git-sha>" >&2
  exit 1
fi

ARCHIVE=$1
REVISION=$2
if [[ ! -f ${ARCHIVE} ]] || [[ ! ${REVISION} =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Geçersiz arşiv veya sürüm." >&2
  exit 1
fi

RELEASES=/srv/neta/releases
TARGET=${RELEASES}/${REVISION}
STAGING=${TARGET}.staging
PREVIOUS=
if [[ -L /srv/neta/current ]]; then
  PREVIOUS=$(readlink -f /srv/neta/current)
fi

rm -rf -- "${STAGING}"
install -d -o root -g neta -m 0750 "${STAGING}"
tar -xzf "${ARCHIVE}" -C "${STAGING}"
chown -R root:neta "${STAGING}"
chmod -R u=rwX,g=rX,o= "${STAGING}"

set -a
# shellcheck disable=SC1091
source /etc/neta/neta.env
set +a

runuser -u neta -- env \
  DATABASE_PATH="${DATABASE_PATH}" \
  /usr/bin/node "${STAGING}/scripts/migrate-sqlite.mjs"

if [[ -e ${TARGET} ]]; then
  rm -rf -- "${TARGET}"
fi
mv "${STAGING}" "${TARGET}"
ln -sfn "${TARGET}" /srv/neta/current
systemctl enable neta.service
systemctl restart neta.service

healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ ${healthy} != true ]]; then
  journalctl -u neta.service -n 100 --no-pager >&2 || true
  if [[ -n ${PREVIOUS} && -d ${PREVIOUS} ]]; then
    ln -sfn "${PREVIOUS}" /srv/neta/current
    systemctl restart neta.service
  fi
  echo "Yeni sürüm sağlık kontrolünü geçemedi; önceki sürüme dönüldü." >&2
  exit 1
fi

systemctl start neta-backup.service
echo "Neta ${REVISION} başarıyla yayınlandı."
