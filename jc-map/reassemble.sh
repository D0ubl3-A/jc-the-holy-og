#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat chunks/JC_Map_Part_2.zip.*.part > JC_Map_Part_2.zip
sha256sum -c source.sha256
printf 'Reassembled: %s\n' "$PWD/JC_Map_Part_2.zip"
