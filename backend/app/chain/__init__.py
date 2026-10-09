"""Chain backend selection via CHAIN_BACKEND (memory | web3)."""

import os

from app.chain.base import ChainClient, ChainError, TxReceipt

__all__ = ["ChainClient", "ChainError", "TxReceipt", "get_chain"]


def get_chain(backend: str | None = None) -> ChainClient:
    backend = backend or os.environ.get("CHAIN_BACKEND", "memory")
    if backend == "web3":
        from app.chain.web3_client import Web3Chain
        return Web3Chain()
    from app.chain.memory import MemoryChain
    return MemoryChain()
