setx REACT_APP_PRODUCTION_BUILD true /M
setx REACT_APP_DIRECTORY_HOST alpha.db.faims.edu.au /M
for /f "delims=" %i in ('git describe --long --all') do setx REACT_APP_COMMIT_VERSION %i /M

git clean -xfd 
npm ci 
npm run build
npx cap sync android
npx cap open android


