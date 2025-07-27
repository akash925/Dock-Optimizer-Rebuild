# 🚀 AWS Deployment Guide - Dock Optimizer

## 📋 Prerequisites

### 1. Docker Image Registry
```bash
# Set environment variables
export REGISTRY=ghcr.io/dockoptimizer
export IMAGE_NAME=dock-optimizer  
export VERSION=v1.0.0-prod

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push the image
docker push $REGISTRY/$IMAGE_NAME:$VERSION
```

### 2. Environment Variables
Required for all AWS deployments:
```bash
DATABASE_URL=postgresql://neondb_owner:password@host.neon.tech/neondb?sslmode=require
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@dockoptimizer.com
PORT=8080
```

## 🎯 AWS Deployment Options

### Option A: AWS App Runner (Recommended - Easiest)

#### 1. Create apprunner.yaml
```yaml
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "Using pre-built Docker image"
run:
  runtime-version: latest
  command: node dist/server/index.js
  network:
    port: 8080
    env:
      - PORT=8080
  env:
    - name: NODE_ENV
      value: production
```

#### 2. Deploy via AWS Console
1. Go to AWS App Runner console
2. Create service → Source: Container registry
3. Image URI: `ghcr.io/dockoptimizer/dock-optimizer:v1.0.0-prod`
4. Add environment variables
5. Configure health check: `/health`
6. Deploy!

### Option B: AWS ECS Fargate (Scalable)

#### 1. Create ECS Task Definition
```json
{
  "family": "dock-optimizer",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "dock-optimizer",
      "image": "ghcr.io/dockoptimizer/dock-optimizer:v1.0.0-prod",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "8080"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:region:account:parameter/dock-optimizer/database-url"},
        {"name": "SENDGRID_API_KEY", "valueFrom": "arn:aws:ssm:region:account:parameter/dock-optimizer/sendgrid-api-key"}
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dock-optimizer",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2. Deploy ECS Service
```bash
# Create cluster
aws ecs create-cluster --cluster-name dock-optimizer

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster dock-optimizer \
  --service-name dock-optimizer-service \
  --task-definition dock-optimizer:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

### Option C: AWS EKS (Kubernetes)

#### 1. Create Kubernetes Deployment
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dock-optimizer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dock-optimizer
  template:
    metadata:
      labels:
        app: dock-optimizer
    spec:
      containers:
      - name: dock-optimizer
        image: ghcr.io/dockoptimizer/dock-optimizer:v1.0.0-prod
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "8080"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dock-optimizer-secrets
              key: database-url
        - name: SENDGRID_API_KEY
          valueFrom:
            secretKeyRef:
              name: dock-optimizer-secrets
              key: sendgrid-api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: dock-optimizer-service
spec:
  selector:
    app: dock-optimizer
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

## 🔐 Security Setup

### 1. Store Secrets in AWS Systems Manager
```bash
# Store database URL
aws ssm put-parameter \
  --name "/dock-optimizer/database-url" \
  --value "postgresql://user:pass@host/db" \
  --type "SecureString"

# Store SendGrid API key
aws ssm put-parameter \
  --name "/dock-optimizer/sendgrid-api-key" \
  --value "SG.your_api_key" \
  --type "SecureString"
```

### 2. IAM Roles
Create IAM roles with minimum required permissions:
- ECS Task Execution Role
- ECS Task Role (for application permissions)
- App Runner Service Role

## 🌐 Load Balancer & Domain Setup

### Application Load Balancer (for ECS/EKS)
```bash
# Create target group
aws elbv2 create-target-group \
  --name dock-optimizer-targets \
  --protocol HTTP \
  --port 8080 \
  --vpc-id vpc-12345 \
  --health-check-path /health

# Create load balancer
aws elbv2 create-load-balancer \
  --name dock-optimizer-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345
```

### SSL Certificate
```bash
# Request certificate from ACM
aws acm request-certificate \
  --domain-name app.dockoptimizer.com \
  --validation-method DNS
```

## 📊 Monitoring & Logging

### CloudWatch Setup
- **Logs**: Automatic with ECS/App Runner
- **Metrics**: CPU, Memory, Request count
- **Alarms**: High error rate, resource utilization

### Health Checks
All deployments use: `GET /health`
- Returns 200 OK when healthy
- Includes database connectivity check

## 🚀 Deployment Commands

### Push to Registry (First Time)
```bash
export REGISTRY=ghcr.io/dockoptimizer
export IMAGE_NAME=dock-optimizer
export VERSION=v1.0.0-prod

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin

# Push the image
docker push $REGISTRY/$IMAGE_NAME:$VERSION
```

### Deploy Updates
```bash
# Tag new version
docker tag dock-optimizer:prod $REGISTRY/$IMAGE_NAME:v1.0.1

# Push new version
docker push $REGISTRY/$IMAGE_NAME:v1.0.1

# Update ECS service (example)
aws ecs update-service \
  --cluster dock-optimizer \
  --service dock-optimizer-service \
  --force-new-deployment
```

## ✅ Post-Deployment Checklist

- [ ] Application responds to health checks
- [ ] Database connectivity verified
- [ ] Email notifications working
- [ ] SSL certificate configured
- [ ] Domain name pointing to load balancer
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented

## 💡 Cost Optimization

### App Runner
- **Best for**: Simple deployment, low maintenance
- **Cost**: Pay for usage, scales to zero
- **Estimate**: $20-50/month for typical usage

### ECS Fargate
- **Best for**: Predictable traffic, more control
- **Cost**: Pay for allocated resources
- **Estimate**: $30-80/month depending on sizing

### EKS
- **Best for**: Complex deployments, multiple services
- **Cost**: Cluster + node costs
- **Estimate**: $100+/month (includes cluster management fee)

---

**Recommendation**: Start with **AWS App Runner** for simplicity, migrate to ECS Fargate if you need more control or cost optimization. 