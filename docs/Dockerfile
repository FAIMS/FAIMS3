FROM sphinxdoc/sphinx

WORKDIR /docs
COPY --chown=33:33 requirements.txt /docs/
RUN pip3 install --no-cache-dir -r requirements.txt && \
    chown -R 33:33 /docs

USER 33:33
