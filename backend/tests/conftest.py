import os

# Tests run on the in-memory chain unless CHAIN_BACKEND is set explicitly in the shell,
# so a web3 setting in .env never spends testnet gas during `make test`.
os.environ.setdefault("CHAIN_BACKEND", "memory")
