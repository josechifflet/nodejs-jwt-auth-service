# Include .env only if exists
ifneq ("$(wildcard .env)", "")
	include .env
	export
endif

# Default variables
BRANCH ?= $(shell git symbolic-ref --short HEAD)
BRANCH_TAG := $(shell echo $(BRANCH) | tr / _)
COMMIT_HASH := $(shell git rev-parse HEAD)
REG := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_DEFAULT_REGION).amazonaws.com
REPO := $(REG)/$(CODES_API_IMAGE_REPO)
MIGRATION_NAME ?=

# Targets
.PHONY: clean install build dev-run-int dev-run-unit ci-run-int ci-run-unit \
        up-dev up-ci-env db-pull db-push migrate-dev migrate-deploy run-integration-tests \
        down dev-wallet-pk docker-login deploy list

# Clean node_modules, coverage and dist folders
clean:
	@echo "Cleaning up..."
	rm -rf node_modules coverage dist

# Install necessary packages
install:
	@echo "Installing dependencies..."
	yarn install

# Build the handlers project
build: install
	@echo "Building project..."
	yarn build
	@echo "Generating Prisma client..."
	yarn prisma:generate

# Run integration tests locally
dev-run-int: up-dev
	@echo "Running integration tests locally..."
	yarn test:int

# Run unit tests locally
dev-run-unit:
	@echo "Running unit tests locally..."
	yarn test:unit

# Run integration tests in CI
ci-run-int: up-ci-env
	@echo "Running integration tests in CI..."
	yarn test:int --ci

# Run unit tests in CI
ci-run-unit: up-ci-env
	@echo "Running unit tests in CI..."
	yarn test:unit --ci

# Start development database
up-dev:
	@echo "Starting development database..."
	docker compose up -d postgres
	docker compose up -d redis

# Start CI environment database
up-ci-env:
	@echo "Setting up CI environment..."
	./scripts/get-env-ci.sh codes-management-api/ci/env-variables .env.ci
	docker compose up -d postgres

# Pull the database schema
db-pull:
	@echo "Pulling database schema..."
	yarn prisma db pull

# Push the database schema
db-push:
	@echo "Pushing database schema..."
	yarn prisma db push

# Run migrations in development
migrate-dev:
	@if [ -z "$(MIGRATION_NAME)" ]; then \
		echo "Error: Migration name not provided! Use: make migrate-dev MIGRATION_NAME=<your_migration_name>"; \
		exit 1; \
	fi
	@echo "Running migrations in development..."
	yarn prisma migrate dev --name $(MIGRATION_NAME)

# Deploy migrations
migrate-deploy:
	@echo "Deploying migrations..."
	yarn prisma migrate deploy

# Run integration tests
run-integration-tests: up-ci-env
	@echo "Running integration tests..."
	yarn test:int

# Tear down Docker containers and prune
down:
	@echo "Tearing down Docker containers and pruning..."
	docker compose down --remove-orphans -v
	docker system prune -a --volumes -f

# Generate development wallet private key
dev-wallet-pk:
	@echo "Generating development wallet private key..."
	./scripts/generate-dev-pk.sh

# Log in to AWS ECR
docker-login:
	@echo "Logging in to AWS ECR..."
	aws ecr get-login-password --region $(AWS_DEFAULT_REGION) --profile $(AWS_PROFILE) | docker login --username AWS --password-stdin $(REG)

# Build and push Docker image to AWS ECR
deploy: docker-login
	@echo "Building and pushing Docker image to AWS ECR..."
	docker build --no-cache --progress plain -t $(REPO):$(COMMIT_HASH)_$(BRANCH_TAG) .
	docker push $(REPO):$(COMMIT_HASH)_$(BRANCH_TAG)
	docker tag $(REPO):$(COMMIT_HASH)_$(BRANCH_TAG) $(REPO):$(CODES_API_LATEST_TAG)
	docker push $(REPO):$(CODES_API_LATEST_TAG)

# List images in the AWS ECR repository
list:
	@echo "Listing images in AWS ECR repository..."
	aws ecr list-images --repository-name $(CODES_API_IMAGE_REPO) --profile $(AWS_PROFILE) --region $(AWS_DEFAULT_REGION)
