turbo='npx turbo'
$turbo fix --force && $turbo lint --force && npx oxfmt . && npx oxfmt --check . 
