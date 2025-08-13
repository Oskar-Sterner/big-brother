Big Brother the event watcher

## 🚀 Features

### Core Capabilities

- **High-throughput event ingestion** with async processing queues
- **Real-time metrics aggregation** with sliding window calculations
- **WebSocket connections** for live dashboard updates
- **Plugin architecture** for extensible event processors
- **Intelligent caching** with automatic invalidation
- **Comprehensive rate limiting** and authentication

### Technical Highlights

- **Performance Optimized**: Connection pooling, batch processing, efficient data structures
- **Production Ready**: Health checks, graceful shutdown, structured logging
- **Fully Typed**: Complete TypeScript implementation with Zod validation
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Scalable Architecture**: Microservices-ready with message queuing
- **Real-time Analytics**: Sub-second metric updates via WebSockets

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- [Docker](https://www.docker.com/) and Docker Compose
- Node.js >= 18 (optional, for compatibility)

## 🛠️ Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd big-brother
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Dependencies

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait for services to be ready
docker-compose ps

# Run database migrations
bun run migrate
```

### 4. Start the API

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Interactive API documentation is available at `http://localhost:3000/docs`

### Key Endpoints

#### Authentication

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123","name":"John Doe"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123"}'

# Create API key
curl -X POST http://localhost:3000/api/auth/api-key \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Production Key","permissions":["read","write"]}'
```

#### Event Ingestion

```bash
# Send single event
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "api_call",
    "metadata": {
      "endpoint": "/api/users",
      "method": "GET",
      "statusCode": 200
    },
    "duration": 45.2
  }'

# Send batch events
curl -X POST http://localhost:3000/api/events/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {"type": "pageview", "metadata": {"page": "/home"}},
      {"type": "click", "metadata": {"button": "signup"}}
    ]
  }'
```

#### Metrics & Aggregation

```bash
# Get aggregated metrics
curl -X POST http://localhost:3000/api/metrics/aggregate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "metric": "response_time",
    "aggregationType": "p95",
    "interval": "5m",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T01:00:00Z"
  }'

# Get real-time stats
curl http://localhost:3000/api/metrics/realtime/response_time?interval=1m \
  -H "Authorization: Bearer <token>"
```

#### WebSocket Real-time Updates

```javascript
const ws = new WebSocket("ws://localhost:3000/api/ws/realtime");

ws.on("open", () => {
  // Subscribe to metrics
  ws.send(
    JSON.stringify({
      type: "subscribe",
      payload: {
        metrics: ["response_time", "error_rate"],
        aggregationWindow: "5s",
      },
    })
  );
});

ws.on("message", (data) => {
  const message = JSON.parse(data);
  console.log("Real-time update:", message);
});
```

## 🏗️ Architecture

### System Components

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Clients   │────▶│   Fastify    │────▶│    Redis    │
└─────────────┘     │   API Server │     │   (Cache/   │
                    └──────────────┘     │   Queue)    │
                            │            └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  PostgreSQL  │◀────│  Workers    │
                    │   Database   │     │  (Async)    │
                    └──────────────┘     └─────────────┘
```

### Plugin Architecture

Create custom event processors by extending the base processor:

```typescript
// src/processors/custom.processor.ts
import { BaseProcessor } from "./base.processor";
import { Event } from "../schemas/event.schema";

export class CustomProcessor extends BaseProcessor {
  name = "CustomProcessor";

  shouldProcess(event: Event): boolean {
    return event.type === "custom";
  }

  async process(event: Event): Promise<void> {
    // Your custom processing logic
    await this.logProcessing(event);
    // Process the event
  }
}
```

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific test suite
bun test src/tests/unit/

# Run with coverage
bun test --coverage
```

## 📊 Performance Metrics

The system is designed to handle:

- **10,000+ events/second** ingestion rate
- **Sub-100ms** p95 query latency
- **Real-time updates** within 50ms
- **99.9% uptime** with graceful degradation

### Benchmarking

```bash
# Run performance benchmarks
bun run benchmark

# Load testing with k6
k6 run tests/load/spike.js
```

## 🔧 Configuration

### Environment Variables

| Variable                  | Description                  | Default |
| ------------------------- | ---------------------------- | ------- |
| `PORT`                    | Server port                  | 3000    |
| `DATABASE_URL`            | PostgreSQL connection string | -       |
| `REDIS_URL`               | Redis connection string      | -       |
| `JWT_SECRET`              | JWT signing secret           | -       |
| `RATE_LIMIT_MAX`          | Max requests per window      | 100     |
| `AGGREGATION_INTERVAL_MS` | Metrics aggregation interval | 5000    |
| `BATCH_SIZE`              | Event batch processing size  | 1000    |

### Database Schema

The system uses optimized PostgreSQL schemas with:

- JSONB columns for flexible metadata
- GIN indexes for fast JSON queries
- Partitioning for time-series data
- Materialized views for aggregations

## 🚢 Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t big-brother .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n analytics
```

### Health Checks

- `/api/health` - Basic health check
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe with dependency checks

## 🔒 Security

- **JWT Authentication** with refresh tokens
- **API Key Management** with scoped permissions
- **Rate Limiting** per user/IP
- **Input Validation** with Zod schemas
- **SQL Injection Protection** via parameterized queries
- **XSS Protection** with Helmet.js
- **CORS Configuration** for cross-origin requests

## 📈 Monitoring (work in progress not yet finished)

The API exposes Prometheus-compatible metrics:

```bash
# Metrics endpoint
curl http://localhost:3000/metrics
```

Key metrics:

- `api_requests_total` - Total API requests
- `api_request_duration_seconds` - Request latency
- `events_processed_total` - Events processed
- `queue_size` - Current queue depth
