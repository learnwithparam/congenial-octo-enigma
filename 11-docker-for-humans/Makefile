.PHONY: help setup install dev test clean build up down logs shell
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## Show this help
	@echo "$(BLUE)Docker for Humans$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initial setup (create .env, install deps)
	@if [ ! -f .env ]; then \
		echo "$(BLUE)Creating .env file...$(NC)"; \
		cp .env.example .env; \
		echo "$(GREEN)Done. Edit .env with your values.$(NC)"; \
	else \
		echo "$(YELLOW).env already exists$(NC)"; \
	fi
	@npm install
	@echo "$(GREEN)Setup complete$(NC)"

install: ## Install dependencies
	@npm install

dev: ## Start development server
	@npm run dev

test: ## Run tests
	@npm test

clean: ## Remove node_modules and dist
	@rm -rf node_modules dist
	@echo "$(GREEN)Cleaned$(NC)"

build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker compose build
	@echo "$(GREEN)Built$(NC)"

up: ## Start all containers
	@echo "$(BLUE)Starting containers...$(NC)"
	docker compose up -d
	@echo "$(GREEN)Running$(NC)"

down: ## Stop all containers
	@echo "$(BLUE)Stopping containers...$(NC)"
	docker compose down
	@echo "$(GREEN)Stopped$(NC)"

logs: ## View container logs
	docker compose logs -f

shell: ## Open shell in app container
	docker compose exec app /bin/sh
