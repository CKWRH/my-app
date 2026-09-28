CREATE TABLE IF NOT EXISTS sensor_readings (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL DEFAULT 'default',
  temperature_c REAL NOT NULL CHECK (temperature_c BETWEEN -40 AND 125),
  stepper_status TEXT NOT NULL CHECK (stepper_status IN ('stopped', 'moving', 'error')),
  servo_angle REAL NOT NULL CHECK (servo_angle BETWEEN 0 AND 180),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_recorded_at
  ON sensor_readings(device_id, recorded_at DESC);