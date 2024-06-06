#!/bin/bash

version=$(./bin/getDescribeString.sh)

sed -i -e "s/\`.*\`/'$version'/" src/version.ts