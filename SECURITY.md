# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.
Report them privately through GitHub: **Security → Report a vulnerability** on this repository
(private vulnerability reporting). Include the affected endpoint or file, the steps to reproduce
and the impact you expect.

You will get an acknowledgement within a few days, and a fix or mitigation plan once the issue is
confirmed. Reporters are credited in the release notes unless they prefer otherwise.

## Supported versions

Only the latest release receives security fixes.

## Design notes

The security model — authentication, the two-layer tenant isolation with PostgreSQL Row-Level
Security, and the public attack surface — is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
