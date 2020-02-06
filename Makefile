PROJECT_ID=my-demo-project-267014

build:
	gcloud auth login
	gcloud config set project ${PROJECT_ID}
	gcloud builds submit --tag gcr.io/${PROJECT_ID}/storage-events ./service/