# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.2] - 2026-07-08

### Changes

- chore: query invalidations in web ([#2176](https://github.com/FAIMS/FAIMS3/pull/2176))
- feat: scroll new field name input into view on creation ([#2174](https://github.com/FAIMS/FAIMS3/pull/2174))
- feat: select recommended offline map region for survey with app prompts to download during activation ([#2173](https://github.com/FAIMS/FAIMS3/pull/2173))
- chore: map control refactor ([#2171](https://github.com/FAIMS/FAIMS3/pull/2171))
- feat: removing redundant status display and improving team element of template form + permissions fix ([#2170](https://github.com/FAIMS/FAIMS3/pull/2170))
- build: pre-commit hooks with Husky ([#2169](https://github.com/FAIMS/FAIMS3/pull/2169))
- fix: notebook crashes if loading route when de-activated, or after removal ([#2168](https://github.com/FAIMS/FAIMS3/pull/2168))
- chore: formatting, CI, linting, type checks ([#2167](https://github.com/FAIMS/FAIMS3/pull/2167))
- feat: styling improvements ([#2166](https://github.com/FAIMS/FAIMS3/pull/2166))
- feat: add admin user impersonation in API, web, and app ([#2165](https://github.com/FAIMS/FAIMS3/pull/2165))
- docs: add Computed Value field user documentation ([#2163](https://github.com/FAIMS/FAIMS3/pull/2163))
- fix: attachments stuck on saving... and navigation no longer locked ([#2162](https://github.com/FAIMS/FAIMS3/pull/2162))
- feat: adds search to designer and improved field selection ([#2161](https://github.com/FAIMS/FAIMS3/pull/2161))
- fix: persist and enable editing of field labels for templated string … ([#2160](https://github.com/FAIMS/FAIMS3/pull/2160))
- fix: restoring map layout after MUI v9 ([#2159](https://github.com/FAIMS/FAIMS3/pull/2159))
- chore: missing wiring for CDK for excluded team role ([#2158](https://github.com/FAIMS/FAIMS3/pull/2158))
- Release v1.6.1 ([#2157](https://github.com/FAIMS/FAIMS3/pull/2157))
- feat: geopackage export and improved random record generation pipeline ([#2156](https://github.com/FAIMS/FAIMS3/pull/2156))
- feat: filter forms which are visible in the overview map ([#2154](https://github.com/FAIMS/FAIMS3/pull/2154))
- Chore: update PR template - add testing checklist item ([#2152](https://github.com/FAIMS/FAIMS3/pull/2152))
- Fix: duplicate dialog not showing when field is collapsed ([#2150](https://github.com/FAIMS/FAIMS3/pull/2150))
- chore: add watch option for libs and use it in localdev.sh ([#2147](https://github.com/FAIMS/FAIMS3/pull/2147))
- Feat: enable notebook and team storage stats ([#2146](https://github.com/FAIMS/FAIMS3/pull/2146))
- feat: add ComputedField field type ([#2141](https://github.com/FAIMS/FAIMS3/pull/2141))
- fix(designer): scope condition field picker to current form ([#2140](https://github.com/FAIMS/FAIMS3/pull/2140))
- fix(forms): make location edit icon smaller ([#2139](https://github.com/FAIMS/FAIMS3/pull/2139))
- fix: install @faims3/forms deps in Docker build so localdev.sh --all works ([#2138](https://github.com/FAIMS/FAIMS3/pull/2138))
- feat(web): sort surveys & templates lists by created date ([#2137](https://github.com/FAIMS/FAIMS3/pull/2137))
- Chore/update node and pnpm ([#2132](https://github.com/FAIMS/FAIMS3/pull/2132))
- feat: add duplicate condition option in conditional editor ([#2128](https://github.com/FAIMS/FAIMS3/pull/2128))
- feat(designer): allow collapse fields to be duplicated too ([#2127](https://github.com/FAIMS/FAIMS3/pull/2127))
- fix: placement of info tooltip icon in app next to heading ([#2126](https://github.com/FAIMS/FAIMS3/pull/2126))
- fix: improve field error styling and remove redundant boxes ([#2125](https://github.com/FAIMS/FAIMS3/pull/2125))
- fix: make advanced-helper popup responsive and fix close icon placement ([#2124](https://github.com/FAIMS/FAIMS3/pull/2124))
- fix: use normal font for child-record HRIDs instead of monospace ([#2123](https://github.com/FAIMS/FAIMS3/pull/2123))
- fix(forms): improve address autosuggest dropdown rendering and label ([#2122](https://github.com/FAIMS/FAIMS3/pull/2122))
- fixes clear seelction and related updates in same space ([#2121](https://github.com/FAIMS/FAIMS3/pull/2121))
- fix: undo functionality in helper and advancedhelper text fields ([#2119](https://github.com/FAIMS/FAIMS3/pull/2119))
- restore DASS logo to what it was before ([#2117](https://github.com/FAIMS/FAIMS3/pull/2117))
- feat: update teams user roles and survey roles information ([#2115](https://github.com/FAIMS/FAIMS3/pull/2115))
- Fix/add user docs for audio recording ([#2105](https://github.com/FAIMS/FAIMS3/pull/2105))
- improvements in sign up and registration screens ([#2103](https://github.com/FAIMS/FAIMS3/pull/2103))

## [1.6.1] - 2026-06-26

### Changes

- feat: geopackage export and improved random record generation pipeline ([#2156](https://github.com/FAIMS/FAIMS3/pull/2156))
- feat: filter forms which are visible in the overview map ([#2154](https://github.com/FAIMS/FAIMS3/pull/2154))
- Chore: update PR template - add testing checklist item ([#2152](https://github.com/FAIMS/FAIMS3/pull/2152))
- chore: add watch option for libs and use it in localdev.sh ([#2147](https://github.com/FAIMS/FAIMS3/pull/2147))
- fix(designer): scope condition field picker to current form ([#2140](https://github.com/FAIMS/FAIMS3/pull/2140))
- fix(forms): make location edit icon smaller ([#2139](https://github.com/FAIMS/FAIMS3/pull/2139))
- fix: install @faims3/forms deps in Docker build so localdev.sh --all works ([#2138](https://github.com/FAIMS/FAIMS3/pull/2138))
- feat(web): sort surveys & templates lists by created date ([#2137](https://github.com/FAIMS/FAIMS3/pull/2137))
- feat: add duplicate condition option in conditional editor ([#2128](https://github.com/FAIMS/FAIMS3/pull/2128))
- feat(designer): allow collapse fields to be duplicated too ([#2127](https://github.com/FAIMS/FAIMS3/pull/2127))
- fix: placement of info tooltip icon in app next to heading ([#2126](https://github.com/FAIMS/FAIMS3/pull/2126))
- fix: improve field error styling and remove redundant boxes ([#2125](https://github.com/FAIMS/FAIMS3/pull/2125))
- fix: make advanced-helper popup responsive and fix close icon placement ([#2124](https://github.com/FAIMS/FAIMS3/pull/2124))
- fix: use normal font for child-record HRIDs instead of monospace ([#2123](https://github.com/FAIMS/FAIMS3/pull/2123))
- fix(forms): improve address autosuggest dropdown rendering and label ([#2122](https://github.com/FAIMS/FAIMS3/pull/2122))
- fixes clear selection and related updates in same space ([#2121](https://github.com/FAIMS/FAIMS3/pull/2121))
- fix: undo functionality in helper and advancedhelper text fields ([#2119](https://github.com/FAIMS/FAIMS3/pull/2119))
- feat: update teams user roles and survey roles information ([#2115](https://github.com/FAIMS/FAIMS3/pull/2115))
- Fix/add user docs for audio recording ([#2105](https://github.com/FAIMS/FAIMS3/pull/2105))
- improvements in sign up and registration screens ([#2103](https://github.com/FAIMS/FAIMS3/pull/2103))

## [1.6.0] - 2026-06-10

### Changes

- feat: add directional record sync modes with large-notebook defaults and settings UX ([#2113](https://github.com/FAIMS/FAIMS3/pull/2113))
- replaced orange flame to notebook so build pipeline can generate the consistent logos ([#2111](https://github.com/FAIMS/FAIMS3/pull/2111))
- update designer dialog for fixing progress upon navigation ([#2108](https://github.com/FAIMS/FAIMS3/pull/2108))
- Fix/corrections after mui v9 update ([#2106](https://github.com/FAIMS/FAIMS3/pull/2106))
- feat: improved knip setup ([#2104](https://github.com/FAIMS/FAIMS3/pull/2104))
- refactor: unify UiSpec field/component-parameter types under a Zod source of truth in @faims3/data-model ([#2102](https://github.com/FAIMS/FAIMS3/pull/2102))
- fix: web forms should match optional description ([#2101](https://github.com/FAIMS/FAIMS3/pull/2101))
- feat: Improved Button Text ([#2099](https://github.com/FAIMS/FAIMS3/pull/2099))
- add fix to allow clear while drawing line ([#2097](https://github.com/FAIMS/FAIMS3/pull/2097))
- improve child record display and make font consistent ([#2096](https://github.com/FAIMS/FAIMS3/pull/2096))
- enhancements for location map buttons ([#2095](https://github.com/FAIMS/FAIMS3/pull/2095))
- Feat/add warning dialog on finish record ([#2094](https://github.com/FAIMS/FAIMS3/pull/2094))
- feat(forms): zoom images in advanced helper popup ([#2093](https://github.com/FAIMS/FAIMS3/pull/2093))
- fix overlay issue in android side nav ([#2091](https://github.com/FAIMS/FAIMS3/pull/2091))
- feat: make record list search case insensitive (#2011) ([#2090](https://github.com/FAIMS/FAIMS3/pull/2090))
- chore(deps): bump uuid from 9.0.0 to 14.0.0 in /app ([#2088](https://github.com/FAIMS/FAIMS3/pull/2088))
- feat: remove metadataDB and significant refinement to notebook shape, typing and migrations ([#2086](https://github.com/FAIMS/FAIMS3/pull/2086))
- chore(deps-dev): bump turbo from 2.5.8 to 2.9.14 ([#2085](https://github.com/FAIMS/FAIMS3/pull/2085))
- Fix docker build of api ([#2083](https://github.com/FAIMS/FAIMS3/pull/2083))
- fix: wire migrateNotebooksOnStartup to API env ([#2082](https://github.com/FAIMS/FAIMS3/pull/2082))
- Chore/migrate to mui v9 ([#2081](https://github.com/FAIMS/FAIMS3/pull/2081))
- Fix vite dependency issue in web development server ([#2080](https://github.com/FAIMS/FAIMS3/pull/2080))
- feat: add PercentageSlider field for forms and designer ([#2078](https://github.com/FAIMS/FAIMS3/pull/2078))
- feat(web): highlight public templates and filter by public/private ([#2077](https://github.com/FAIMS/FAIMS3/pull/2077))
- New/origin/feat/designer restructure and improvements ([#2074](https://github.com/FAIMS/FAIMS3/pull/2074))
- fix: avoid errant stdout reaching changelog in release script ([#2073](https://github.com/FAIMS/FAIMS3/pull/2073))
- chore(deps): bump axios from 1.12.2 to 1.15.2 ([#2068](https://github.com/FAIMS/FAIMS3/pull/2068))
- feat: add AudioRecorder field type (#2004) ([#2059](https://github.com/FAIMS/FAIMS3/pull/2059))
- chore(deps-dev): bump postcss from 8.5.6 to 8.5.10 ([#2056](https://github.com/FAIMS/FAIMS3/pull/2056))
- Bump dompurify from 3.2.7 to 3.4.0 ([#2051](https://github.com/FAIMS/FAIMS3/pull/2051))
- Bump addressable from 2.8.7 to 2.9.0 in /app/android ([#2048](https://github.com/FAIMS/FAIMS3/pull/2048))
- chore(deps): bump multer from 2.0.2 to 2.1.1 ([#1965](https://github.com/FAIMS/FAIMS3/pull/1965))
- New E2E testing setup to generate screenshots ([#1596](https://github.com/FAIMS/FAIMS3/pull/1596))
- Deal with loading states for teams ([#1571](https://github.com/FAIMS/FAIMS3/pull/1571))
- Make records search case insensitive in the record list ([#2011](https://github.com/FAIMS/FAIMS3/issues/2011))
- Add an Audio field for sound recording ([#2004](https://github.com/FAIMS/FAIMS3/issues/2004))

## [1.5.2] - 2026-05-07

### Changes

- feat: improved handling of digest algorithms ([#2071](https://github.com/FAIMS/FAIMS3/pull/2071))
- feat: public templates and visibility controls ([#2070](https://github.com/FAIMS/FAIMS3/pull/2070))
- fix: offset version mismatch banner warning to safe area ([#2069](https://github.com/FAIMS/FAIMS3/pull/2069))
- fix: missing build vars ([#2067](https://github.com/FAIMS/FAIMS3/pull/2067))
- feat: add deflation option to SAML ([#2065](https://github.com/FAIMS/FAIMS3/pull/2065))
- feat: avoid sending full template payload in list endpoints ([#2064](https://github.com/FAIMS/FAIMS3/pull/2064))
- fix: incorrect test default ([#2063](https://github.com/FAIMS/FAIMS3/pull/2063))
- feat: configurable AuthnRequest binding ([#2062](https://github.com/FAIMS/FAIMS3/pull/2062))
- Release v1.5.1 ([#2061](https://github.com/FAIMS/FAIMS3/pull/2061))
- chore: wire FORCE_REMOTE_DELETION and DELETE_ON_DEACTIVATION in app builds ([#2060](https://github.com/FAIMS/FAIMS3/pull/2060))

## [1.5.1] - 2026-05-05

### Changes

- chore: wire FORCE_REMOTE_DELETION and DELETE_ON_DEACTIVATION in app builds ([#2060](https://github.com/FAIMS/FAIMS3/pull/2060))

## [1.5.0] - 2026-05-01

### Changes

- feat: add role descriptions to role selector dropdowns (#2012) ([#2046](https://github.com/FAIMS/FAIMS3/pull/2046))
- Bump nodemailer from 8.0.4 to 8.0.5 ([#2045](https://github.com/FAIMS/FAIMS3/pull/2045))
- feat: overhaul of resource deletion and archiving lifecycle including projects, records, templates and users ([#2044](https://github.com/FAIMS/FAIMS3/pull/2044))
- Fix: don't offer the contains conditions for string values ([#2042](https://github.com/FAIMS/FAIMS3/pull/2042))
- feat: optional templateFunction on field registry for templating ([#2041](https://github.com/FAIMS/FAIMS3/pull/2041))
- Bump vite from 5.4.21 to 7.3.2 ([#2040](https://github.com/FAIMS/FAIMS3/pull/2040))
- Fix: configuration for 'web' title in AWS deployment ([#2039](https://github.com/FAIMS/FAIMS3/pull/2039))
- Bump vite from 7.1.12 to 7.3.2 ([#2038](https://github.com/FAIMS/FAIMS3/pull/2038))
- Fix: Add fieldmark theme option to aws-cdk ([#2035](https://github.com/FAIMS/FAIMS3/pull/2035))
- Bump lodash from 4.17.23 to 4.18.1 ([#2032](https://github.com/FAIMS/FAIMS3/pull/2032))
- Fix: remove publishButtonBehaviour setting ([#2030](https://github.com/FAIMS/FAIMS3/pull/2030))
- Feat: allow Operations Admin to change own team role ([#2029](https://github.com/FAIMS/FAIMS3/pull/2029))
- Fix warnings in web build ([#2025](https://github.com/FAIMS/FAIMS3/pull/2025))
- Bump handlebars from 4.7.7 to 4.7.9 ([#2022](https://github.com/FAIMS/FAIMS3/pull/2022))
- Bump nodemailer from 7.0.11 to 8.0.4 ([#2021](https://github.com/FAIMS/FAIMS3/pull/2021))
- Pull request #2012 (title unavailable — fetch manually)

## [1.4.4] - 2026-04-05

### Changes

- Chore: automate release script ([#2028](https://github.com/FAIMS/FAIMS3/pull/2028))
- Chore: format ([#2026](https://github.com/FAIMS/FAIMS3/pull/2026))
- Chore: migrate lint and format tooling to oxc ([#2008](https://github.com/FAIMS/FAIMS3/pull/2008))
- Feat: data access APIs ([#1999](https://github.com/FAIMS/FAIMS3/pull/1999))
- Feat: multi select improvements ([#2007](https://github.com/FAIMS/FAIMS3/pull/2007))
- Feat: truncate long descriptions in survey and template list tables (… ([#2005](https://github.com/FAIMS/FAIMS3/pull/2005))
- Feat: use pluralize library for proper noun pluralisation (#1870) ([#2001](https://github.com/FAIMS/FAIMS3/pull/2001))
- Fix: ai-lead designer code quality refactor ([#2006](https://github.com/FAIMS/FAIMS3/pull/2006))
- Fix: embed X509 KeyInfo in signed SP metadata for VANguard ([#2031](https://github.com/FAIMS/FAIMS3/pull/2031))
- Fix: stale invites interfere with SSO login ([#2024](https://github.com/FAIMS/FAIMS3/pull/2024))

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
