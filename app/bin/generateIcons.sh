#!/bin/bash

SOURCE=public/static/logo/Fieldmark-Square-NoText-WhiteBG.png
mkdir -p tmp

for size in 16 20 29 32 40 50 57 58 60 64 72 76 80 87 100 114 120 128 144 152 167 180 256 512 1024
do
    convert $SOURCE -resize $size -background white "tmp/$size.png"
done
