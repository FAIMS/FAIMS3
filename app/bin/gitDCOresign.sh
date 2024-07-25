#!/usr/bin/env bash

git rebase --signoff -i ${1}^
echo "If you're happy, git push --force-with-lease"