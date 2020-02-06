provider "google-beta" {
  project = var.project
  region  = "europe-west1"
  zone    = "europe-west1-b"
  version = "~>v3.6.0"
}
