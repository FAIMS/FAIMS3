
docker: Dockerfile
	docker build -t sphinx-builder .

user-docs: docker
	docker run -it --rm\
		-v ./user:/docs\
		-e VITE_APP_NAME\
		-e VITE_NOTEBOOK_NAME\
		-e VITE_WEBSITE_TITLE\
		-e VITE_THEME\
		sphinx-builder make html


developer-docs: docker
	docker run -it --rm\
		-v ./developer:/docs\
		-e VITE_APP_NAME\
		-e VITE_NOTEBOOK_NAME\
		-e VITE_WEBSITE_TITLE\
		-e VITE_THEME\
		sphinx-builder make html
