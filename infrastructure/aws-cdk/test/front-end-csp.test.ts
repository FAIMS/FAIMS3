/**
 * CloudFront connect-src must allow presigned map-layer object fetches.
 */
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {frontendConnectSrc} from '../lib/components/front-end';

describe('frontendConnectSrc', () => {
  it('allows Control Centre to fetch presigned map-asset objects and blob URLs', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'CspTest', {
      env: {account: '123456789012', region: 'ap-southeast-2'},
    });
    const bucket = new s3.Bucket(stack, 'map-asset-attachments');

    const csp = frontendConnectSrc({
      includeBlob: true,
      extraOrigins: ['https://api.example.com'],
      mapAssetBucket: bucket,
    });

    expect(
      csp.startsWith("connect-src 'self' blob: https://api.example.com ")
    ).toBe(true);
    expect(csp).toContain(`https://${bucket.bucketRegionalDomainName}`);
    expect(csp).toContain('*.bugsnag.com');
    expect(csp).toContain('api.maptiler.com');
    expect(csp).toContain('*.openstreetmap.org');
  });
});
