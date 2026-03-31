# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.3] - 2026-3-20

- added zoom to photos in read only view to be tested well in phone ([#1985](https://github.com/FAIMS/FAIMS3/pull/1985))
- build: website static build for docs ([#1971](https://github.com/FAIMS/FAIMS3/pull/1971))
- Default location in maps improvements ([#1980](https://github.com/FAIMS/FAIMS3/pull/1980))
- docs: correct role display names to match UI ([#1969](https://github.com/FAIMS/FAIMS3/pull/1969))
- Don't throw errors when tokens expire ([#1998](https://github.com/FAIMS/FAIMS3/pull/1998))
- feat: adds an additional button click step for email verification ([#1975](https://github.com/FAIMS/FAIMS3/pull/1975))
- feat: adds grace period for login banner ([#1978](https://github.com/FAIMS/FAIMS3/pull/1978))
- feat: auto suggest address search ([#1979](https://github.com/FAIMS/FAIMS3/pull/1979))
- feat: data access APIs ([#1999](https://github.com/FAIMS/FAIMS3/pull/1999))
- feat: easier addition of notebooks from home page ([#1986](https://github.com/FAIMS/FAIMS3/pull/1986))
- feat: improved section validation triggering ([#1977](https://github.com/FAIMS/FAIMS3/pull/1977))
- feat: map overview improvements ([#1989](https://github.com/FAIMS/FAIMS3/pull/1989))
- feat: replace default theme with FAIMS branding and rename old defaul… ([#1963](https://github.com/FAIMS/FAIMS3/pull/1963))
- feat: take photo navigation, race conditions, reliability improvements ([#1976](https://github.com/FAIMS/FAIMS3/pull/1976))
- feat: use pluralize library for proper noun pluralisation (#1870) ([#2001](https://github.com/FAIMS/FAIMS3/pull/2001))
- fix: errant false string output ([#1973](https://github.com/FAIMS/FAIMS3/pull/1973))
- fix: invalidate projects cache when creating survey from template ([#1972](https://github.com/FAIMS/FAIMS3/pull/1972))
- Fix: make sure provisioning config is passed throut in cdk ([#1966](https://github.com/FAIMS/FAIMS3/pull/1966))
- Photos, bulleted list, formatting fixes in richtext editor ([#1990](https://github.com/FAIMS/FAIMS3/pull/1990))
- Provision users on first SSO login ([#1964](https://github.com/FAIMS/FAIMS3/pull/1964))

## [1.4.2] - 2026-3-3

- Add fill option to export docs in swagger ([#1959](https://github.com/FAIMS/FAIMS3/pull/1959))
- Don't check invites on login success ([#1951](https://github.com/FAIMS/FAIMS3/pull/1951))
- Ensure getSelectedServer returns one if configured ([#1958](https://github.com/FAIMS/FAIMS3/pull/1958))
- export MIGRATE_OLD_DATABASES setting in workflows ([#1952](https://github.com/FAIMS/FAIMS3/pull/1952))

## [1.4.1] - 2026-0-0

- Add OPERATIONS_ADMIN global role ([#1894](https://github.com/FAIMS/FAIMS3/pull/1894))
- Allow disabling of local login, no password reset for SSO users ([#1927](https://github.com/FAIMS/FAIMS3/pull/1927))
- bug: convertDataForOutput running excessively - geojson export performance ([#1924](https://github.com/FAIMS/FAIMS3/pull/1924))
- Bump ajv from 8.17.1 to 8.18.0 ([#1941](https://github.com/FAIMS/FAIMS3/pull/1941))
- Bump faraday from 1.10.4 to 1.10.5 in /app/android ([#1932](https://github.com/FAIMS/FAIMS3/pull/1932))
- Bump markdown-it from 14.1.0 to 14.1.1 ([#1934](https://github.com/FAIMS/FAIMS3/pull/1934))
- Bump version to 1.4.1 ([#1950](https://github.com/FAIMS/FAIMS3/pull/1950))
- chore: bump minor release 1.4.0 ([#1921](https://github.com/FAIMS/FAIMS3/pull/1921))
- feat: adds zxcvbn password complexity check ([#1928](https://github.com/FAIMS/FAIMS3/pull/1928))
- feat: all in one exports ([#1917](https://github.com/FAIMS/FAIMS3/pull/1917))
- feat: bugsnag API integration ([#1905](https://github.com/FAIMS/FAIMS3/pull/1905))
- feat: integration for bugsnag into /web ([#1912](https://github.com/FAIMS/FAIMS3/pull/1912))
- feat: logging solution for forms ([#1913](https://github.com/FAIMS/FAIMS3/pull/1913))
- feat: makes hydration caching less aggressive for visible page ([#1895](https://github.com/FAIMS/FAIMS3/pull/1895))
- feat: server version mismatch alerts ([#1920](https://github.com/FAIMS/FAIMS3/pull/1920))
- feat: speech to text fields ([#1893](https://github.com/FAIMS/FAIMS3/pull/1893))
- feat: xml SAML metadata signing ([#1911](https://github.com/FAIMS/FAIMS3/pull/1911))
- Fix bad dev server in web ([#1914](https://github.com/FAIMS/FAIMS3/pull/1914))
- Fix reset-password page ([#1949](https://github.com/FAIMS/FAIMS3/pull/1949))
- Fix some warnings about DOM nesting in dashboard ([#1900](https://github.com/FAIMS/FAIMS3/pull/1900))
- fix: full footer missing variable replacements ([#1896](https://github.com/FAIMS/FAIMS3/pull/1896))
- fix: missing idpPublicKey env variable ([#1906](https://github.com/FAIMS/FAIMS3/pull/1906))
- infra: adds enhanced observability for ECS containers, and allows configuring desired capacity ([#1922](https://github.com/FAIMS/FAIMS3/pull/1922))
- Invites for Global Roles ([#1907](https://github.com/FAIMS/FAIMS3/pull/1907))
- Notebook migrations on API startup ([#1946](https://github.com/FAIMS/FAIMS3/pull/1946))
- UI for selecting a server in a multi-server configuration ([#1943](https://github.com/FAIMS/FAIMS3/pull/1943))
- Update XCode version in IOS workflows ([#1916](https://github.com/FAIMS/FAIMS3/pull/1916))