include .env
export 

docker: Dockerfile
	docker build -t sphinx-builder .

user-docs: docker
	docker run -it --rm\
		-v ./user:/docs\
		-e VITE_APP_NAME\
		-e VITE_NOTEBOOK_NAME\
		-e VITE_WEBSITE_TITLE\
		-e VITE_THEME\
		-e VITE_API_URL\
		-e VITE_APP_URL\
		-e VITE_WEB_URL\
		-e ANDROID_APP_PUBLIC_URL\
		-e IOS_APP_PUBLIC_URL\
		sphinx-builder make html


developer-docs: docker
	docker run -it --rm\
		-v ./developer:/docs\
		-e VITE_APP_NAME\
		-e VITE_NOTEBOOK_NAME\
		-e VITE_WEBSITE_TITLE\
		-e VITE_THEME\
		-e VITE_API_URL\
		-e VITE_APP_URL\
		-e VITE_WEB_URL\
		-e ANDROID_APP_PUBLIC_URL\
		-e IOS_APP_PUBLIC_URL\
		sphinx-builder make html
