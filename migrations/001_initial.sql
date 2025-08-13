CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  permissions TEXT[] NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  metadata JSONB,
  tags TEXT[],
  value NUMERIC,
  duration NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  value NUMERIC NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  tags JSONB,
  aggregation_type VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE slow_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  duration NUMERIC NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type VARCHAR(255) NOT NULL,
  message TEXT,
  stack_trace TEXT,
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_tags ON events USING GIN(tags);
CREATE INDEX idx_events_metadata ON events USING GIN(metadata);

CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_tags ON metrics USING GIN(tags);

CREATE INDEX idx_slow_requests_endpoint ON slow_requests(endpoint);
CREATE INDEX idx_slow_requests_timestamp ON slow_requests(timestamp);

CREATE INDEX idx_errors_type ON errors(error_type);
CREATE INDEX idx_errors_timestamp ON errors(timestamp);
CREATE INDEX idx_errors_user_id ON errors(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();