# Usage ./build.sh user
#  or ./build.sh developer/docs
# to build documentation with configuration from the environment

docker run -it --rm\
  -v ./$1:/docs\
  -e VITE_APP_NAME\
  -e VITE_NOTEBOOK_NAME\
  -e VITE_WEBSITE_TITLE\
  -e VITE_THEME\
  sphinx-builder make html