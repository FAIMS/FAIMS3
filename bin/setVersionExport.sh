#!/usr/bin/env sh

set -euo pipefail
cd /app/
echo "export REACT_APP_CURRENT_VERSION=\"$(/app/bin/getDescribeString.sh)\"" >> /etc/bash.bashrc