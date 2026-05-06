echo "pnpm version"
pnpm --version

echo "Installing deps"
pnpm i

echo "Building website with vite and pnpm"
pnpm run build
