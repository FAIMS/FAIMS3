turbo='npx turbo'
$turbo fix --force && $turbo lint --force && npx oxfmt --write && npx oxfmt --check .
