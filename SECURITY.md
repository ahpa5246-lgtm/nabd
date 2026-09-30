# Security

NABD v1 is local-first and does not require a backend. Financial transactions are stored in the browser's localStorage on the user's device.

## Important considerations

- Do not deploy secrets or private API keys in the frontend.
- Treat exported JSON/CSV files as sensitive financial data.
- On shared computers, clear local data after use.
- If cloud sync or authentication is added, move sensitive operations server-side and add encryption, access controls, audit logs, rate limiting, and secure secret management.

Do not post sensitive reproduction data in a public issue.
