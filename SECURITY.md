# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x | ✓ Active support |
| < 2.0 | ✘ No support |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:
1. GitHub Security Advisory (preferred)
2. Email to raman@worktif.com

### What to Include

- Type of issue (buffer overflow, injection, etc.)
- Full paths of source file(s) related to the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

### Response Timeline

| Severity | Initial Response | Fix Timeline |
|----------|------------------|--------------|
| Critical | 24 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 1 week | 30 days |
| Low | 2 weeks | 90 days |

### Disclosure Policy

- We follow a 90-day disclosure deadline
- We will coordinate disclosure timing with you
- We will credit you in the security advisory (unless you prefer anonymity)

## Security Updates

Security updates are published via:
- GitHub Security Advisories
- Release notes

## Security Best Practices

When using stdio_bus:

1. **Keep updated**: Always use the latest patch version
2. **Validate input**: Don't trust messages from untrusted sources
3. **Use TLS**: For TCP transport, use TLS termination
4. **Limit resources**: Configure appropriate buffer limits
5. **Monitor**: Enable audit logging for security-sensitive operations
