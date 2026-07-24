# AWS CDK design: couch-auth-proxy

Design for deploying
[`couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy) in the
existing FAIMS AWS CDK stack so public sync traffic is ACL-filtered and CouchDB
is no longer reachable as a world-readable member DB.

Companion to
[CouchAuthProxyHandover](CouchAuthProxyHandover.md) (application cutover) and
local `docker-compose.yml` (reference topology). This document is the
**infrastructure** brief; it does not replace the app/migration runbook.

---

## 0. Mission

**Goal.** In AWS:

1. Browser / mobile Pouch sync hits **couch-auth-proxy** on the public Couch
   hostname (TLS at the ALB).
2. Conductor keeps **admin** access to CouchDB on a **VPC-internal** URL
   (bypass proxy).
3. CouchDB port `5984` is **not** on the internet-facing ALB and is reachable
   only from the proxy and Conductor security groups.
4. Cutover is gated: DATA DBs at migration v2 **before** public traffic flips
   to the proxy (same order as handover §13).

**Non-goals (v1).**

- Multi-AZ Couch clustering / proxy sticky sessions beyond what ALB already
  provides.
- Replacing Conductor JWT issuance or Couch `jwt_keys`.
- Private subnets + NAT redesign (current stack is public-subnet only).
- DigitalOcean Terraform implementation (same principles; sketched at end).

---

## 1. Current AWS topology (gap)

```text
Internet
   │
   ▼
Shared ALB (HTTPS :443)
   ├─ host conductor.*  → ECS Fargate Conductor
   └─ host couch.*      → EC2 CouchDB :5984   ← PUBLIC, DB-wide reads

Conductor env today:
  COUCHDB_PUBLIC_URL   = https://couch.*
  COUCHDB_INTERNAL_URL = https://couch.*   ← same target
```

Relevant code:

| Piece | Path | Today |
| ----- | ---- | ----- |
| Stack wiring | `infrastructure/aws-cdk/lib/faims-infra-stack.ts` | Couch + Conductor share ALB |
| Couch EC2 + ALB TG | `…/components/couch-db.ts` | ALB → instance:5984 |
| Conductor env | `…/components/conductor.ts` | Public == Internal URL |
| App CSP | `…/components/front-end.ts` | `connect-src` includes `https://couch.*` |
| Networking | `…/components/networking.ts` | Public VPC, shared ALB, no NAT |

Local compose already matches the **target** split (`COUCHDB_PUBLIC_URL` →
proxy `:5985`, Conductor → Couch). AWS does not.

---

## 2. Target topology

```text
Internet
   │
   ▼
Shared ALB (HTTPS :443)
   ├─ host conductor.*  → ECS Conductor
   └─ host couch.*      → ECS couch-auth-proxy :8000
                              │
                              │  VPC only (SG)
                              ▼
                         EC2 CouchDB :5984
                              ▲
                              │  VPC only (SG)
                         ECS Conductor (admin Basic)
```

| Config | Value after cutover |
| ------ | ------------------- |
| `COUCHDB_PUBLIC_URL` | `https://couch.<baseDomain>` (unchanged hostname → **proxy**) |
| `COUCHDB_INTERNAL_URL` | `http://<couch-private-dns-or-ip>:5984` (Conductor only) |

Keeping the **same public hostname** avoids mobile/web rebuilds for Couch URL
and keeps the existing CloudFront CSP `connect-src` entry valid.

---

## 3. Placement decision: ECS Fargate proxy (recommended)

### Options considered

| Option | Idea | Pros | Cons |
| ------ | ---- | ---- | ---- |
| **A. Sidecar on Couch EC2** | Second Docker unit next to Couch (compose-like) | Lowest latency; mirrors local compose; no extra Fargate $ | User-data / AMI churn replaces EC2; couples proxy deploys to DB host; harder independent rollback |
| **B. ECS Fargate service** | New service like Conductor on shared ALB | Independent image pin/rollback; matches Conductor CDK patterns; no Couch instance replacement to ship proxy | Extra task cost; needs SG path proxy→Couch |
| **C. Proxy on Conductor task** | Sidecar container in Conductor task def | Shared deploy | Wrong blast radius; scales with API not sync; couples secrets/lifecycle |

**Recommendation: Option B — `CouchAuthProxy` ECS Fargate construct.**

Rationale:

- Shipping the proxy must not risk Couch EC2 replacement (user-data changes
  historically replace the instance; data volume is separate but ops pain is
  real).
- Conductor already proves the ALB + Fargate + Secrets Manager pattern.
- Image pin (`ghcr.io/peterbaker0/couch-auth-proxy:sha-…`) can track the
  vendored `_design/acl` version in `@faims3/data-model` without touching the
  DB host.

Option A remains a valid fallback for tiny single-node demos if Fargate cost
must be zero; do not use it as the production default.

---

## 4. Security model

### 4.1 Network

| Flow | Allow? | Mechanism |
| ---- | ------ | --------- |
| Internet → ALB :443 → proxy :8000 | Yes | Existing shared ALB host rule on `couch.*` |
| Internet → ALB → Couch :5984 | **No** | Remove / stop registering Couch TG on public listener |
| Proxy tasks → Couch :5984 | Yes | SG: Couch ingress from proxy SG only (plus Conductor) |
| Conductor tasks → Couch :5984 | Yes | SG: Couch ingress from Conductor SG |
| Internet → Couch :5984 directly | **No** | No public IP listener on 5984; instance SG deny world |
| SSM to Couch EC2 (ops) | Optional | Keep existing SSM; do not open 5984 to `0.0.0.0/0` |

Couch should listen on `0.0.0.0:5984` **inside** the instance/docker network
as today, but **security groups** are the boundary (current stack already
relies on SG + ALB rather than binding localhost-only).

### 4.2 Credentials

| Secret | Consumer | Notes |
| ------ | -------- | ----- |
| Couch admin user/password | Conductor + **proxy** | Existing `EC2CouchDB.passwordSecret`; grant proxy task `secretsmanager:GetSecretValue` |
| JWT signing keys | Conductor (issue) / Couch (`jwt_keys`) | Unchanged; proxy uses `AUTH_RESOLVE_VIA_COUCH_SESSION=true` |
| Proxy-specific secrets | None in v1 | No separate HMAC if session resolve stays Couch-native |

Never put Couch admin credentials in plaintext task env; use
`ecs.Secret.fromSecretsManager` like Conductor.

### 4.3 Proxy hardening env (prod)

Mirror compose, production-tight:

```bash
COUCH_URL=http://<internal-couch-host>:5984
COUCH_ADMIN_USER=...          # from Secrets Manager
COUCH_ADMIN_PASSWORD=...      # from Secrets Manager
ACL_DB_INCLUDE=/^data-/       # mandatory — never ACL people/projects/auth
ACL_ROUTE_INCLUDE=pouch-sync,session
ACL_AUTO_INSTALL=false        # FAIMS provisions _design/acl
AUTH_RESOLVE_VIA_COUCH_SESSION=true
CORS_ORIGINS=https://faims.<base>,https://web.<base>   # from config
PORT=8000
HOST=0.0.0.0
```

Optional later: `COUCH_PRELOAD_DBS` for known `data-*` DBs if cold-cache latency
matters.

### 4.4 Application-layer defense (unchanged)

Proxy is the **sync read boundary**. Keep:

- `_design/permissions` VDU
- API `canReadRecord`
- App `shouldDisplayRecord` (UX only)

Fail closed: do not flip the ALB target until DATA migration v2 has completed
on all `data-*` DBs (unstamped docs are world-readable to members under the
proxy).

### 4.5 Optional extras (not required for v1)

- AWS WAF web ACL on the shared ALB (rate limits / geo) for `couch.*` host.
- ALB access logs → S3 for sync forensics.
- Separate CloudWatch dashboard for proxy 5xx / target response time (reuse
  Couch ALB metric pattern with the new target group).

---

## 5. CDK shape

### 5.1 New construct

Add `infrastructure/aws-cdk/lib/components/couch-auth-proxy.ts`:

```ts
export interface CouchAuthProxyProps {
  vpc: ec2.IVpc;
  sharedBalancer: SharedBalancer;
  domainName: string; // couch.<baseDomain> — same public host
  hz: route53.IHostedZone;
  certificate: acm.ICertificate;
  /** Internal Couch base URL, e.g. http://10.0.x.x:5984 */
  couchInternalUrl: string;
  couchAdminSecret: sm.ISecret;
  /** SG on the Couch EC2 instance — will receive ingress from this service */
  couchSecurityGroup: ec2.ISecurityGroup;
  corsOrigins: string[];
  image: string; // ghcr.io/peterbaker0/couch-auth-proxy
  imageTag: string; // pin digest/tag matching data-model ddoc 2.3.0
  cpu: number;
  memory: number;
  desiredCount: number;
}

export class CouchAuthProxy extends Construct {
  readonly service: ecs.FargateService;
  readonly serviceSecurityGroup: ec2.SecurityGroup;
  readonly publicEndpoint: string; // https://couch.*
  readonly targetGroup: elb.ApplicationTargetGroup;
}
```

Responsibilities:

1. ECS cluster (or share Conductor cluster — either is fine; dedicated cluster
   keeps blast radius clearer).
2. Task definition: container port `8000`, env above, admin secrets, awslogs.
3. Fargate service in public subnets with `assignPublicIp: true` (same as
   Conductor; no NAT today).
4. Target group health check:
   - path `/_couch-auth-proxy/health` (or `/_couch-auth-proxy/ready`)
   - healthy HTTP codes `200`
5. Register host rule on shared ALB for `domainName` → **this** TG (priority
   replace Couch’s current rule).
6. DNS `A` alias for `couch.*` stays on the shared ALB (already created by
   `EC2CouchDB` — either move record ownership to the proxy construct or leave
   it on Couch construct and only swap the TG). Prefer **one owner** of the
   DNS record to avoid duplicates: keep DNS in Couch construct **or** move
   both DNS + public host rule into a small `CouchPublicEndpoint` helper.

### 5.2 Changes to `EC2CouchDB`

1. **Stop** attaching the instance to the public ALB target group for app
   traffic (or stop creating that TG entirely once proxy owns `couch.*`).
2. **Export** `securityGroup` and a stable internal URL:
   - v1 pragmatic: `http://${instance.instancePrivateIp}:5984`
   - nicer: VPC-private Route53 record `couch-internal.<baseDomain>` → private
     IP (private hosted zone associated with the VPC) so Conductor does not
     depend on a raw IP string in env when instances rotate.
3. Keep cookie secret + admin secret generation unchanged.
4. Ingress: allow `5984` from proxy SG + Conductor SG only (remove “from ALB”
   once ALB no longer targets Couch).

Instance replacement risk: prefer **not** to change user-data in the same
deploy that flips the ALB, unless necessary. SG + TG changes do not require
user-data edits.

### 5.3 Changes to `FaimsConductor`

Split endpoints:

```ts
environment: {
  COUCHDB_PUBLIC_URL: props.couchDBPublicEndpoint,   // https://couch.* (proxy)
  COUCHDB_INTERNAL_URL: props.couchDBInternalEndpoint, // http://internal:5984
  // ...
}
```

Today both props are the same string — that is the bug relative to the
handover.

Conductor must continue using admin Basic against the **internal** URL for
migrations, Records CRUD export paths, and `_security` management.

### 5.4 Changes to `FaimsInfraStack`

```ts
const couchDb = new EC2CouchDB(...); // no public ALB target (or gated)

const proxy = new CouchAuthProxy(this, 'couch-auth-proxy', {
  domainName: domains.couch,
  couchInternalUrl: couchDb.internalEndpoint,
  couchAdminSecret: couchDb.passwordSecret,
  couchSecurityGroup: couchDb.securityGroup,
  corsOrigins: [
    `https://${domains.faims}`,
    `https://${domains.web}`,
  ],
  image: config.couchAuthProxy.image,
  imageTag: config.couchAuthProxy.imageTag,
  // cpu/memory/desiredCount from config
  ...
});

// Ensure SG edges
couchDb.securityGroup.connections.allowFrom(
  proxy.serviceSecurityGroup,
  ec2.Port.tcp(5984),
  'Proxy to Couch'
);

const conductor = new FaimsConductor(this, 'conductor', {
  couchDBEndpoint: proxy.publicEndpoint,        // PUBLIC
  couchDBInternalEndpoint: couchDb.internalEndpoint,
  // grant Conductor SG → Couch :5984
  ...
});
```

Frontend CSP can keep `https://${domains.couch}` — hostname unchanged.

### 5.5 Config schema (`lib/config.ts` + `configs/sample.json`)

```json
"couchAuthProxy": {
  "enabled": true,
  "image": "ghcr.io/peterbaker0/couch-auth-proxy",
  "imageTag": "sha-3004091",
  "cpu": 512,
  "memory": 1024,
  "desiredCount": 2
}
```

Zod: required when present; pin `imageTag` in README next to data-model ACL
ddoc version **2.3.0**.

`enabled: false` preserves legacy “ALB → Couch” for emergency rollback only.
Document that rollback re-opens the read gap.

---

## 6. Cutover procedure (AWS)

Align with handover §13; infra-specific steps:

1. **Deploy application build** that stamps ACL + DATA v1→v2 migration while
   `couchAuthProxy.enabled` is still `false` (public URL still raw Couch) **or**
   deploy code first with proxy not yet receiving traffic.
2. **Run migrations** (`MIGRATE_NOTEBOOKS_ON_STARTUP` / initialise) until every
   `data-*` is at version **2**. Optionally
   `pnpm --filter=@faims3/api run repair-data-db-acl`.
3. **Deploy CDK** with proxy service up, but keep ALB host rule on Couch **or**
   use a temporary hostname `couch-proxy.*` for soak tests.
4. **Validate** through proxy hostname:
   - `GET /_couch-auth-proxy/health` → 200
   - guest A/B isolation (same cases as
     `api/test/couchAuthProxy.integration.test.ts`)
5. **Flip** ALB `couch.*` rule to proxy TG; set Conductor
   `COUCHDB_PUBLIC_URL` → proxy; `COUCHDB_INTERNAL_URL` → internal Couch;
   remove ALB→Couch registration; tighten SGs.
6. **Clients** rebuild local data DBs via `openLocalDataDbWithAclCutover` on
   next activate (app change already on proxy integration branch).

Rollback: point ALB + `COUCHDB_PUBLIC_URL` back at Couch (accept read-gap
regression) or scale proxy to 0 only after restoring Couch TG.

---

## 7. Observability

| Signal | Source |
| ------ | ------ |
| Proxy healthy hosts | ALB `HealthyHostCount` on proxy TG |
| Proxy 5xx | ALB `HTTPCode_Target_5XX_Count` on proxy TG |
| Proxy logs | CloudWatch Logs `/ecs/couch-auth-proxy` (or stream prefix) |
| Couch host metrics | Existing EC2 / CWAgent dashboard |
| Conductor→Couch failures | Conductor app logs (internal URL errors) |

Alarms: reuse the Couch HTTP 5xx pattern against the **proxy** target group;
add “healthy host &lt; 1” on the proxy TG.

---

## 8. Image supply chain

- Pin by **digest or immutable `sha-*` tag** (compose already uses
  `sha-3004091`).
- Document that tag must match vendored map/VDU in
  `library/data-model/src/data_storage/dataDB/acl.ts` (upstream ddoc **2.3.0**).
- GHCR pull: if the image is public, Fargate can pull without auth; if private,
  add a Secrets Manager GHCR token and `repositoryCredentials` on the
  container definition.
- Prefer not to use floating `latest`.

---

## 9. Implementation checklist (follow-on coding PR)

```text
[ ] Add CouchAuthProxyConfig to config Zod schema + sample.json
[ ] Implement CouchAuthProxy ECS construct
[ ] Export couch SG + internalEndpoint from EC2CouchDB
[ ] Stop public ALB targeting Couch when proxy enabled
[ ] Split COUCHDB_PUBLIC_URL / COUCHDB_INTERNAL_URL in FaimsConductor
[ ] Wire SGs: proxy→5984, conductor→5984; deny ALB→5984
[ ] Health check on /_couch-auth-proxy/health
[ ] README + DeployingAWSStack.md cutover notes
[ ] cdk synth against sample config; cdk diff on a non-prod account
[ ] Soak on staging hostname, then flip couch.* 
```

Suggested commit split:

1. Construct + config (proxy enabled but optional; no prod flip).
2. Stack wiring + Conductor URL split behind `couchAuthProxy.enabled`.
3. Docs / runbook only if not already covered here.

---

## 10. DigitalOcean (sketch)

Same security invariants; different primitives:

| AWS | DigitalOcean analogue |
| --- | --------------------- |
| ALB host `couch.*` → proxy :8000 | LB `forwarding_rule` `target_port = 8000` |
| ECS proxy service | Second Docker container on Couch droplet **or** small droplet |
| SG to :5984 | Droplet firewall / VPC firewall: 5984 only from proxy + Conductor |
| Secrets Manager | DO secure env / injected `conductor.env` |
| `COUCHDB_INTERNAL_URL` | `http://<private-vpc-ip>:5984` or docker bridge |

Today `infrastructure/digital-ocean/couchdb/loadbalancer.tf` forwards **443 →
5984**. Change target to the proxy port and stop publishing Couch on the LB.
Conductor env must gain an internal Couch URL (currently only
`COUCHDB_PUBLIC_URL` in `conductor.env.dist`).

---

## 11. Decision summary

| Decision | Choice |
| -------- | ------ |
| Proxy runtime | ECS Fargate on shared ALB |
| Public hostname | Keep `couch.<baseDomain>` (CSP/URL stable) |
| Couch public ALB | Remove after cutover |
| Conductor→Couch | VPC SG + internal HTTP URL |
| Admin creds | Existing Secrets Manager secret |
| ACL scope | `ACL_DB_INCLUDE=/^data-/`, `ACL_AUTO_INSTALL=false` |
| Cutover gate | DATA v2 migration before ALB flip |
| Rollback | Re-attach Couch TG (reopens read gap) |

---

## 12. References

| Path | Why |
| ---- | --- |
| [CouchAuthProxyHandover](CouchAuthProxyHandover.md) | App ACL model + cutover order |
| `docker-compose.yml` (`couch-auth-proxy` service) | Reference env + healthcheck |
| `infrastructure/aws-cdk/lib/components/couch-db.ts` | Current public Couch exposure |
| `infrastructure/aws-cdk/lib/components/conductor.ts` | URL env wiring to split |
| `infrastructure/aws-cdk/lib/components/networking.ts` | Shared ALB helpers |
| [DeployingAWSStack](../DeployingAWSStack.md) | Operator deploy guide (update when implementing) |
| Upstream [USER-GUIDE](https://github.com/PeterBaker0/couch-auth-proxy) | Proxy ops / ACL semantics |
