output "backup_timer_configuration" {
  description = "Effective non-secret CouchDB backup schedule and retention configuration"
  value = {
    on_calendar          = var.backup_on_calendar
    randomized_delay_sec = var.backup_randomized_delay_sec
    retention = {
      daily   = var.backup_keep_daily
      weekly  = var.backup_keep_weekly
      monthly = var.backup_keep_monthly
    }
    tag     = var.backup_tag
    log_dir = var.backup_log_dir
  }
}
