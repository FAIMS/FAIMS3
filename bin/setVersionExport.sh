#!/usr/bin/env bash

set -euo pipefail
cd /app/
echo "export REACT_APP_CURRENT_VERSION=\"$(/app/bin/getDescribeString.sh)\"" >> /etc/bash.bashrc