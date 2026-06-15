# CivicOS — common developer commands.
# Usage: make <target>

.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up down build logs seed test fe-dev be-dev ps clean reset proxy

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Build and start the full stack (frontend, backend, postgres, redis)
	$(COMPOSE) up --build

down: ## Stop and remove containers
	$(COMPOSE) down

build: ## Build all images
	$(COMPOSE) build

proxy: ## Start with the optional single-origin nginx reverse proxy (port 8080)
	$(COMPOSE) --profile proxy up --build

logs: ## Tail backend logs (OTP codes & notifications appear here)
	$(COMPOSE) logs -f backend

ps: ## Show running services
	$(COMPOSE) ps

seed: ## Re-run the idempotent seeder inside the backend container
	$(COMPOSE) exec backend python -m app.seeds.seed

test: ## Run backend unit tests
	cd backend && python -m pytest -q

be-dev: ## Run the backend locally (needs a local postgres/redis or set DATABASE_URL)
	cd backend && uvicorn app.main:app --reload --port 8000

fe-dev: ## Run the frontend dev server
	cd frontend && npm install && npm run dev

clean: ## Remove containers and the postgres volume (DESTROYS data)
	$(COMPOSE) down -v

reset: clean up ## Wipe everything and start fresh
