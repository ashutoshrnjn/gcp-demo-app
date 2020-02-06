# resource "google_cloudbuild_trigger" "filename-trigger" {
#   trigger_template {
#     branch_name = "master"
#     repo_name   = "git@github.com:ashutoshrnjn/gcp-demo-app.git"
#   }
#   filename = "cloudbuild.yaml"
# }

resource google_storage_bucket "main-bucket" {
  project            = var.project
  name               = "${var.project}-main-bucket"
  location           = "EU"
  storage_class      = "MULTI_REGIONAL"
  bucket_policy_only = false
  force_destroy      = true

  versioning {
    enabled = false
  }
}

resource google_storage_bucket "second-bucket" {
  project            = var.project
  name               = "${var.project}-second-bucket"
  location           = "EU"
  storage_class      = "MULTI_REGIONAL"
  bucket_policy_only = false
  force_destroy      = true

  versioning {
    enabled = false
  }
}

resource "google_service_account" "sr-account" {
  project      = var.project
  account_id   = "project-sr-account"
  display_name = "Service Account"
}

resource "google_project_iam_binding" "sr-account" {
    project      = var.project
    role    = "roles/iam.serviceAccountAdmin"
    members = [
         "serviceAccount:${google_service_account.sr-account.email}"
    ]
}
resource "google_storage_bucket_iam_binding" "main-bucket-admin" {
  bucket = google_storage_bucket.main-bucket.name
  role = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${google_service_account.sr-account.email}"
  ]
}
resource "google_storage_bucket_iam_binding" "secondary-bucket-admin" {
  bucket = google_storage_bucket.second-bucket.name
  role = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${google_service_account.sr-account.email}"
  ]
}

resource "google_project_iam_member" "storage_events_cloudrun" {
  for_each = toset([
    "roles/run.invoker",
    "roles/storage.objectAdmin",
    "roles/pubsub.publisher",
    "roles/logging.logWriter",
    "roles/iam.serviceAccountTokenCreator"
  ])

  project = var.project
  member  = "serviceAccount:${google_service_account.sr-account.email}"
  role    = each.value
}


resource "google_pubsub_topic" "storage_events" {
  name    = "storage-events"
  project = var.project
}

resource "google_pubsub_topic_iam_binding" "editor" {
  project = var.project
  topic = google_pubsub_topic.storage_events.name
  role = "roles/viewer"
  members = [
    "serviceAccount:${google_service_account.sr-account.email}"
  ]
}

resource "google_pubsub_subscription" "push" {
  name    = "push-subscription"
  project = var.project
  topic   = google_pubsub_topic.storage_events.name

  ack_deadline_seconds = 20

  push_config {
    push_endpoint = google_cloud_run_service.run.status[0].url
    oidc_token {
      service_account_email = google_service_account.sr-account.email
    }
  }
}

# A push subscription pushes bucket events to this service,
# which forwards them to tasks
resource "google_cloud_run_service" "run" {
  provider = google-beta
  name     = "storage-events"
  project  = var.project
  location = "europe-west1"

  metadata {
    namespace = var.project
  }

  template {
    spec {
      service_account_name = google_service_account.sr-account.email
      containers {
        image = "gcr.io/${var.project}/gcp-demo-app"
      }
    }
  }
}

// Bucket triggers
data "google_storage_project_service_account" "gcs_account" {
  project = var.project
}

resource "google_storage_notification" "notification" {
  bucket         = "${var.project}-main-bucket"
  payload_format = "JSON_API_V1"
  topic          = google_pubsub_topic.storage_events.id
  event_types    = ["OBJECT_FINALIZE", "OBJECT_DELETE"]
  depends_on     = [google_pubsub_topic_iam_binding.binding]
}

resource "google_pubsub_topic_iam_binding" "binding" {
  project = var.project
  topic   = google_pubsub_topic.storage_events.id
  role    = "roles/pubsub.publisher"
  members = ["serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"]
}