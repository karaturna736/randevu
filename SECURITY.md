# Neta Security Policy

## Supported production branch

`main` is the only production branch. Production releases are built from locked dependencies and deployed through the repository's GitHub Actions workflow.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data, exploit payloads, or a working attack against production. Report the issue privately to the repository owner with:

- affected route or component,
- impact and prerequisites,
- minimal reproduction steps,
- whether real customer data or credentials may be exposed.

Credentials or tokens discovered during testing must not be copied into tickets, commits, chat messages, or screenshots.

## Security checks

The repository uses secret scanning, static analysis, dependency vulnerability scanning, production security-header verification, and a passive ZAP baseline scan. A passing automated scan reduces risk but does not prove that the application is free of vulnerabilities.

## Production testing rules

Only passive or low-impact checks may run automatically against `netarandevu.com`. Destructive tests, credential attacks, denial-of-service tests, mass account creation, or data-modifying scans must use an isolated environment and explicit authorization.
