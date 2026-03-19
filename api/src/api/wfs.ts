/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * OGC WFS 2.0 compatible Web Feature Service for notebook spatial data.
 * One feature type per form/viewset with at least one spatial field.
 * Returns GeoJSON features (same data as ESRI Feature Server).
 */

import {
  Action,
  buildFeatureServiceLayerIndex,
  buildViewsetFieldSummaries,
} from '@faims3/data-model';
import type {FeatureServiceLayerDefinition} from '@faims3/data-model';
import express, {Request, Response} from 'express';
import {z} from 'zod';
import {processRequest} from 'zod-express-middleware';
import {
  countLayerFeatures,
  createRecordIterator,
  initSpatialExportContext,
  streamLayerAsGeoJSON,
  streamLayerAsGML,
} from '../couchdb/export/geospatialExport';
import {getProjectUIModel} from '../couchdb/notebooks';
import * as Exceptions from '../exceptions';
import {
  isAllowedToMiddleware,
  requireAuthenticationAPI,
} from '../middleware';
import {canReadRecord} from '../recordAuth';

function projectIdFromReq(req: {params: {id?: string}}): string {
  const id = req.params.id;
  if (!id) {
    throw new Exceptions.InvalidRequestException('Missing project id');
  }
  return id;
}

function getWfsBaseUrl(req: Request, projectId: string): string {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || '';
  const base = `${protocol}://${host}`.replace(/\/$/, '');
  return `${base}/api/notebooks/${projectId}/WFS`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Get a query parameter by key, case-insensitive (e.g. service, SERVICE). */
function getQueryParam(
  query: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  if (!query || typeof query !== 'object') return undefined;
  const lower = key.toLowerCase();
  const entry = Object.entries(query).find(
    ([k]) => k.toLowerCase() === lower
  );
  return entry ? String(entry[1]) : undefined;
}

export const wfsRouter: express.Router = express.Router({
  mergeParams: true,
});

const wfsAuthDisabled =
  process.env.DISABLE_FEATURE_SERVER_AUTH === 'true';

const readRecordsAuth = wfsAuthDisabled
  ? []
  : [
      requireAuthenticationAPI,
      isAllowedToMiddleware({
        action: Action.READ_MY_PROJECT_RECORDS,
        getResourceId: req => req.params.id,
      }),
    ];

/**
 * GET /api/notebooks/:id/WFS
 * WFS 2.0: REQUEST=GetCapabilities | DescribeFeatureType | GetFeature
 */
wfsRouter.get(
  '/',
  readRecordsAuth,
  processRequest({
    params: z.object({id: z.string().min(1)}),
  }),
  async (req: Request, res: Response) => {
    if (!wfsAuthDisabled && !req.user) {
      throw new Exceptions.UnauthorizedException();
    }
    const projectId = projectIdFromReq(req);
    const requestType =
      getQueryParam(req.query as Record<string, unknown>, 'request') || '';
    const version =
      getQueryParam(req.query as Record<string, unknown>, 'version') || '2.0.0';
    const service =
      getQueryParam(req.query as Record<string, unknown>, 'service') || 'WFS';

    if (service.toUpperCase() !== 'WFS') {
      res.status(400).send(
        'Invalid SERVICE parameter. Use SERVICE=WFS or omit SERVICE (WFS is default).'
      );
      return;
    }

    if (requestType === 'GetCapabilities') {
      try {
        const uiSpec = await getProjectUIModel(projectId);
        const layers: FeatureServiceLayerDefinition[] =
          buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
        const baseUrl = getWfsBaseUrl(req, projectId);

        const featureTypeList = layers
          .map(
            l =>
              `    <FeatureType xmlns:ns="http://www.opengis.net/wfs/2.0">
      <Name>${escapeXml(l.formId)}</Name>
      <Title>${escapeXml(l.name)}</Title>
      <DefaultCRS>http://www.opengis.net/def/crs/OGC/1.3/CRS84</DefaultCRS>
      <OtherCRS>http://www.opengis.net/def/crs/EPSG/0/4326</OtherCRS>
    </FeatureType>`
          )
          .join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<WFS_Capabilities version="2.0.0"
  xmlns="http://www.opengis.net/wfs/2.0"
  xmlns:ows="http://www.opengis.net/ows/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd http://www.opengis.net/ows/1.1 http://schemas.opengis.net/ows/1.1.0/owsAll.xsd">
  <ows:ServiceIdentification>
    <ows:Title>FAIMS3 WFS</ows:Title>
    <ows:Abstract>OGC WFS 2.0 feature service for notebook spatial data. One feature type per form with spatial fields. GeoJSON output.</ows:Abstract>
    <ows:ServiceType>WFS</ows:ServiceType>
    <ows:ServiceTypeVersion>2.0.0</ows:ServiceTypeVersion>
  </ows:ServiceIdentification>
  <ows:OperationsMetadata>
    <ows:Operation name="GetCapabilities">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get href="${escapeXml(baseUrl)}"/>
        </ows:HTTP>
      </ows:DCP>
    </ows:Operation>
    <ows:Operation name="DescribeFeatureType">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get href="${escapeXml(baseUrl)}"/>
        </ows:HTTP>
      </ows:DCP>
    </ows:Operation>
    <ows:Operation name="GetFeature">
      <ows:DCP>
        <ows:HTTP>
          <ows:Get href="${escapeXml(baseUrl)}"/>
        </ows:HTTP>
      </ows:DCP>
      <ows:Parameter name="outputFormat">
        <ows:AllowedValues>
          <ows:Value>application/geo+json</ows:Value>
          <ows:Value>application/json</ows:Value>
          <ows:Value>application/gml+xml; version=3.2</ows:Value>
          <ows:Value>gml3</ows:Value>
          <ows:Value>GML3</ows:Value>
        </ows:AllowedValues>
      </ows:Parameter>
    </ows:Operation>
  </ows:OperationsMetadata>
  <FeatureTypeList>
${featureTypeList}
  </FeatureTypeList>
</WFS_Capabilities>`;

        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
      } catch (err) {
        throw err;
      }
      return;
    }

    if (requestType === 'DescribeFeatureType') {
        const typeName =
          getQueryParam(req.query as Record<string, unknown>, 'typenames') ||
          getQueryParam(req.query as Record<string, unknown>, 'typename') ||
          '';
      if (!typeName) {
        res.status(400).send(
          'DescribeFeatureType requires TYPENAME or TYPENAMES.'
        );
        return;
      }
      try {
        const uiSpec = await getProjectUIModel(projectId);
        const layers: FeatureServiceLayerDefinition[] =
          buildFeatureServiceLayerIndex({uiSpecification: uiSpec});
        const viewFieldsMap = buildViewsetFieldSummaries({
          uiSpecification: uiSpec,
        });
        const requestedTypes = typeName.split(',').map(s => s.trim());
        const layer = layers.find(
          (l: FeatureServiceLayerDefinition) =>
            requestedTypes.includes(l.formId)
        );
        if (!layer) {
          res.status(400).send(
            `Unknown type name(s): ${typeName}. Use GetCapabilities to list feature types.`
          );
          return;
        }
        const fieldSummaries = viewFieldsMap[layer.formId] ?? [];
        const elements = [
          '    <xsd:element name="record_id" type="xsd:string" nillable="true"/>',
          '    <xsd:element name="revision_id" type="xsd:string" nillable="true"/>',
          '    <xsd:element name="type" type="xsd:string" nillable="true"/>',
          '    <xsd:element name="hrid" type="xsd:string" nillable="true"/>',
          '    <xsd:element name="geometry_source_field_id" type="xsd:string" nillable="true"/>',
          ...fieldSummaries.map(
            f =>
              `    <xsd:element name="${escapeXml(f.name)}" type="xsd:string" nillable="true"/>`
          ),
        ].join('\n');
        const typeNameSafe = layer.formId.replace(/-/g, '_');
        const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:faims="http://www.faims.org/notebook"
  targetNamespace="http://www.faims.org/notebook"
  elementFormDefault="qualified">
  <xsd:complexType name="${escapeXml(typeNameSafe)}Type">
    <xsd:sequence>
${elements}
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="${escapeXml(layer.formId)}" type="faims:${escapeXml(typeNameSafe)}Type"/>
</xsd:schema>`;
        res.setHeader('Content-Type', 'application/xml');
        res.send(xsd);
      } catch (err) {
        throw err;
      }
      return;
    }

    if (requestType === 'GetFeature') {
      const typeNames =
        getQueryParam(req.query as Record<string, unknown>, 'typenames') ||
        getQueryParam(req.query as Record<string, unknown>, 'typename') ||
        '';
      if (!typeNames) {
        res.status(400).send(
          'GetFeature requires TYPENAMES or typeName (feature type name). Use GetCapabilities to list types.'
        );
        return;
      }
      const resultType = (
        getQueryParam(req.query as Record<string, unknown>, 'resulttype') ||
        'results'
      ).toLowerCase();
      const outputFormatParam = getQueryParam(
        req.query as Record<string, unknown>,
        'outputformat'
      );
      const acceptHeader = (req.get('Accept') || '').toLowerCase();
      const outputFormat =
        outputFormatParam ||
        (acceptHeader.includes('application/json') &&
        !acceptHeader.includes('xml')
          ? 'application/geo+json'
          : 'application/gml+xml; version=3.2');
      const requestedFormat = outputFormat.toLowerCase();
      const wantsGml = [
        'gml3',
        'gml2',
        'application/gml+xml',
        'text/xml; subtype=gml/3.2',
      ].some(f => requestedFormat.includes(f));
      const wantsGeoJson = [
        'application/geo+json',
        'application/json',
        'application/geojson',
      ].some(f => requestedFormat.includes(f));
      if (!wantsGml && !wantsGeoJson) {
        res.status(400).send(
          `Unsupported outputFormat. Use application/geo+json, application/json, or application/gml+xml; version=3.2 (gml3).`
        );
        return;
      }
      const requestedTypes = typeNames.split(',').map(s => s.trim());
      const startIndex =
        Number(getQueryParam(req.query as Record<string, unknown>, 'startindex')) || 0;
      const countParam =
        getQueryParam(req.query as Record<string, unknown>, 'count') ??
        getQueryParam(req.query as Record<string, unknown>, 'maxfeatures');
      const count = countParam != null && countParam !== '' ? Number(countParam) : undefined;
      const srsNameParam =
        getQueryParam(req.query as Record<string, unknown>, 'srsname') ||
        'urn:ogc:def:crs:OGC:1.3:CRS84';
      const axisOrder =
        srsNameParam.toUpperCase().includes('CRS84') ? 'lonlat' : 'latlon';

      try {
        const context = await initSpatialExportContext(projectId);
        const layers: FeatureServiceLayerDefinition[] =
          buildFeatureServiceLayerIndex({uiSpecification: context.uiSpecification});
        const layer = layers.find((l: FeatureServiceLayerDefinition) =>
          requestedTypes.includes(l.formId)
        );
        if (!layer) {
          res.status(400).send(
            `Unknown TYPENAMES: ${typeNames}. Use GetCapabilities to list feature types.`
          );
          return;
        }
        const layerFormId = layer.formId;
        const iterator = await createRecordIterator(projectId, context);
        const user = req.user;

        async function* filteredHydratedRecords() {
          let next = await iterator.next();
          while (!next.done) {
            const record = next.record;
            next = await iterator.next();
            if (!record || record.type !== layerFormId) continue;
            if (
              !wfsAuthDisabled &&
              user &&
              !canReadRecord({
                user,
                projectId,
                createdBy: record.created_by,
              })
            ) {
              continue;
            }
            yield record;
          }
        }

        if (resultType === 'hits') {
          const numberMatched = await countLayerFeatures(
            context,
            layerFormId,
            filteredHydratedRecords()
          );
          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:GetFeatureResponse numberMatched="${numberMatched}" numberReturned="0"
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd"/>
`;
          res.setHeader('Content-Type', 'application/xml');
          res.send(xml);
          return;
        }

        if (wantsGml) {
          res.setHeader(
            'Content-Type',
            'application/gml+xml; version=3.2; charset=utf-8'
          );
          await streamLayerAsGML(
            context,
            layerFormId,
            filteredHydratedRecords(),
            res,
            {
              resultOffset: startIndex,
              resultRecordCount: count,
              srsName: srsNameParam,
              axisOrder,
            }
          );
        } else {
          res.setHeader('Content-Type', 'application/geo+json');
          await streamLayerAsGeoJSON(
            context,
            layerFormId,
            filteredHydratedRecords(),
            res,
            {resultOffset: startIndex, resultRecordCount: count}
          );
        }
      } catch (err) {
        if (err instanceof Exceptions.InvalidRequestException) throw err;
        throw err;
      }
      return;
    }

    res.status(400).send(
      `Unknown REQUEST. Use REQUEST=GetCapabilities, DescribeFeatureType, or GetFeature.`
    );
  }
);
