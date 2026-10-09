PY := backend/.venv/bin

.PHONY: setup test test-backend test-contracts api node deploy-local deploy-amoy

setup:            ## install everything (needs liboqs: `brew install liboqs`)
	python3.12 -m venv backend/.venv
	$(PY)/pip install -r backend/requirements.txt
	cd contracts && npm install

test: test-backend test-contracts

test-backend:
	cd backend && .venv/bin/pytest -q

test-contracts:
	cd contracts && npx hardhat test

api:              ## seeded demo API on http://localhost:8000/docs
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

node:             ## local chain for recording without testnet risk
	cd contracts && npx hardhat node

deploy-local:
	cd contracts && npx hardhat run scripts/deploy.js --network localhost

deploy-amoy:
	cd contracts && npx hardhat run scripts/deploy.js --network amoy
