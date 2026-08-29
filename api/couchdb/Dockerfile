FROM couchdb:3@sha256:d341311cf03840dfb96a7c1bcf7ef5b6a6a4d2ac53e01e7a5095329cbe8cd37c
COPY --chown=33:33 local.ini.dist /opt/couchdb/etc/local.d/local.ini
COPY --chown=33:33 local.ini* /opt/couchdb/etc/local.d/
RUN chmod 666 /opt/couchdb/etc/local.d/*.ini && \
    chown -R 33:33 /opt/couchdb

USER 33:33
