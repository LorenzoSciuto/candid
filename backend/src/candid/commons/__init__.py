"""Code shared by every component (routers, services, migrations).

Rule enforced by tests/test_architecture.py: routers and services never import
each other's modules; anything they both need lives here. Only ``app.py`` (the
composition root) wires components together.
"""
