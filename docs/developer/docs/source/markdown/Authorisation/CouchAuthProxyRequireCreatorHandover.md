# Require-creator (upstream) — landed

**Repo:** [`PeterBaker0/couch-auth-proxy`](https://github.com/PeterBaker0/couch-auth-proxy)
**Status:** Shipped in **v1.5.0** as `ACL_REQUIRE_CREATOR`. FAIMS enables it in
compose + CDK and does **not** duplicate the rule in `_design/faims_acl_shape`.

See [AclValidationLayering](AclValidationLayering.md) for the full ownership
split.

## Behaviour

When `ACL_REQUIRE_CREATOR=true`, the installed `_design/acl`
`validate_doc_update` rejects non-admin, non-`_design` writes without a
non-empty `creator`. Default `false` preserves historical open-create semantics.
Flipping the flag bumps the ddoc version (`2.3.0` ↔ `2.4.0`) so ensure rewrites
the VDU on next warm.

## FAIMS wiring

```bash
# docker-compose.yml / CDK CouchAuthProxy env
ACL_REQUIRE_CREATOR=true
```

Image pin: `ghcr.io/peterbaker0/couch-auth-proxy:1.6.0` (match compose + CDK;
require-creator itself landed in **1.5.0**).

FAIMS `_design/faims_acl_shape` owns only `record_id` ↔ `parent`.
