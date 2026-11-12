-- Run once if you prefer SQL over `npm run db:driver-tour`

-- 1. Pickup / Drop support for tour stops
ALTER TABLE tour_stops
  ADD COLUMN stop_type ENUM('pickup','stop','drop') NOT NULL DEFAULT 'stop' AFTER stop_name;

-- 2. Driver documents (NIC / licence)
CREATE TABLE IF NOT EXISTS driver_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  driver_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('nic','license') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_driver_documents_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_documents_driver (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
