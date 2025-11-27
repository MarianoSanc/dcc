-- Nueva estructura recomendada para dcc_results

CREATE TABLE dcc_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_dcc VARCHAR(64) NOT NULL,
  name VARCHAR(255),
  ref_type VARCHAR(64),
  data TEXT,           -- JSON serializado: puede ser array de quantities o un objeto simple
  orden INT DEFAULT 1,
  deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_dcc_results_id_dcc ON dcc_results(id_dcc);
CREATE INDEX idx_dcc_results_deleted ON dcc_results(deleted);
