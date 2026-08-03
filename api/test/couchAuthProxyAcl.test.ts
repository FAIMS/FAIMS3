/**
 * Unit tests for couch-auth-proxy warm / ensure gating.
 * Does not require a live Couch or proxy.
 */
import {expect} from 'chai';
import sinon from 'sinon';
import {config} from '../src/buildconfig';
import {warmCouchAuthProxyAclDesignDoc} from '../src/couchdb/couchAuthProxyAcl';

describe('couchAuthProxyAcl warm gating', () => {
  let fetchStub: sinon.SinonStub;
  let originalEnabled: boolean;
  let originalPublic: string;
  let originalInternal: string;

  beforeEach(() => {
    originalEnabled = config.couchAuthProxyEnabled;
    originalPublic = config.couchdbPublicUrl;
    originalInternal = config.couchdbInternalUrl;
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    (config as {couchAuthProxyEnabled: boolean}).couchAuthProxyEnabled =
      originalEnabled;
    (config as {couchdbPublicUrl: string}).couchdbPublicUrl = originalPublic;
    (config as {couchdbInternalUrl: string}).couchdbInternalUrl =
      originalInternal;
    fetchStub.restore();
  });

  it('does not call fetch when COUCH_AUTH_PROXY_ENABLED is false', async () => {
    (config as {couchAuthProxyEnabled: boolean}).couchAuthProxyEnabled = false;
    (config as {couchdbPublicUrl: string}).couchdbPublicUrl =
      'http://localhost:5985';
    (config as {couchdbInternalUrl: string}).couchdbInternalUrl =
      'http://localhost:5984';

    await warmCouchAuthProxyAclDesignDoc('data-test-project');

    expect(fetchStub.called).to.equal(false);
  });

  it('does not call fetch when public URL equals internal URL', async () => {
    (config as {couchAuthProxyEnabled: boolean}).couchAuthProxyEnabled = true;
    (config as {couchdbPublicUrl: string}).couchdbPublicUrl =
      'http://localhost:5984';
    (config as {couchdbInternalUrl: string}).couchdbInternalUrl =
      'http://localhost:5984';

    await warmCouchAuthProxyAclDesignDoc('data-test-project');

    expect(fetchStub.called).to.equal(false);
  });

  it('GETs the public URL when proxy is enabled and URLs differ', async () => {
    (config as {couchAuthProxyEnabled: boolean}).couchAuthProxyEnabled = true;
    (config as {couchdbPublicUrl: string}).couchdbPublicUrl =
      'http://localhost:5985';
    (config as {couchdbInternalUrl: string}).couchdbInternalUrl =
      'http://localhost:5984';

    fetchStub.resolves({ok: true, status: 200} as Response);

    await warmCouchAuthProxyAclDesignDoc('data-test-project');

    expect(fetchStub.calledOnce).to.equal(true);
    expect(fetchStub.firstCall.args[0]).to.equal(
      'http://localhost:5985/data-test-project'
    );
  });
});
