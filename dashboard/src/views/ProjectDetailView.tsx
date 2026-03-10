import {useState, useEffect, useMemo, useRef, useCallback} from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {fromLonLat} from 'ol/proj';
import type {Feature} from 'ol';
import type {Geometry} from 'ol/geom';
import Overlay from 'ol/Overlay';
import 'ol/ol.css';
import {useAuth} from '../auth-context';
import {getDashboardProjectContextValue} from '../context/dashboard-project-context';
import {createHydratedRecordCache} from '../utils/hydrated-cache';
import {getSpatialFieldNames, parseGeoJSONFromFieldData} from '../utils/spatial-fields';
import type {FormUpdateData, HydratedRecord, IAttachmentService, UISpecification} from '@faims3/data-model';
import {DataView} from '@faims3/forms';

const PAGE_SIZE = 25;

type ProjectDetailViewProps = {
  projectId: string;
  onBack: () => void;
};

export function ProjectDetailView({projectId, onBack}: ProjectDetailViewProps) {
  const {user, isAuthenticated, isExpired} = useAuth();
  const ctx = useMemo(() => getDashboardProjectContextValue(), []);
  const [runtime, setRuntime] = useState<ReturnType<typeof ctx.getRuntime>>(undefined);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const cacheRef = useRef<ReturnType<typeof createHydratedRecordCache> | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource<Feature<Geometry>> | null>(null);
  const overlayElRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

  // Resolve runtime and create cache
  useEffect(() => {
    if (!user || !isAuthenticated || isExpired()) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        setCacheReady(false);
        setCacheError(null);
        const rt = await ctx.getOrCreateRuntime(projectId, user);
        if (cancelled) return;
        setRuntime(rt);
        const cache = createHydratedRecordCache(rt.engine);
        cacheRef.current = cache;
        unsubscribe = cache.subscribeToChanges(() => setCacheVersion(v => v + 1));
        await cache.loadInitial(500);
        if (cancelled) return;
        setCacheReady(true);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setCacheError(message);
        setCacheReady(false);
      }
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [projectId, user, isAuthenticated, isExpired, ctx]);

  const records = useMemo(() => {
    const c = cacheRef.current;
    return c ? c.getRecords() : [];
  }, [cacheVersion, cacheReady]);

  const uiSpec = runtime?.engine?.uiSpec;
  const spatialFields = useMemo(
    () => (uiSpec ? getSpatialFieldNames(uiSpec as unknown as UISpecification) : []),
    [uiSpec]
  );

  const mapFeatures = useMemo(() => {
    const features: Array<{type: 'Feature'; geometry: {type: 'Point'; coordinates: [number, number]}; properties?: unknown}> = [];
    for (const record of records) {
      const data = (record as HydratedRecord).data ?? {};
      for (const fieldName of spatialFields) {
        const field = data[fieldName];
        const raw = field && typeof field === 'object' && 'data' in field ? (field as {data: unknown}).data : undefined;
        const parsed = parseGeoJSONFromFieldData(raw);
        for (const f of parsed) {
          features.push({
            ...f,
            properties: {
              ...(typeof f.properties === 'object' && f.properties ? (f.properties as Record<string, unknown>) : {}),
              recordId: record.record._id,
              hrid: record.hrid,
              fieldId: fieldName,
            },
          });
        }
      }
    }
    return features;
  }, [records, spatialFields]);

  // Build map once container and cache are ready
  useEffect(() => {
    const el = mapRef.current;
    if (!el || !runtime) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const overlayEl = overlayElRef.current;
    const overlay = new Overlay({
      element: overlayEl ?? undefined,
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -10],
    });
    overlayRef.current = overlay;

    const map = new Map({
      target: el,
      layers: [
        new TileLayer({source: new OSM()}),
        new VectorLayer({source: vectorSource}),
      ],
      view: new View({
        center: fromLonLat([151.2, -33.85]),
        zoom: 10,
      }),
    });
    mapInstanceRef.current = map;
    map.addOverlay(overlay);

    const onSingleClick = (evt: unknown) => {
      const e = evt as {pixel: number[]; coordinate: number[]};
      const feature = map.forEachFeatureAtPixel(e.pixel, f => f) as Feature<Geometry> | undefined;
      if (!feature) {
        overlay.setPosition(undefined);
        setSelectedRecordId(null);
        setSelectedField(null);
        return;
      }
      const recordId = feature.get('recordId') as string | undefined;
      const fieldId = feature.get('fieldId') as string | undefined;
      if (recordId) {
        setActiveTab('overview');
        setSelectedRecordId(recordId);
        setSelectedField(fieldId ?? null);
        overlay.setPosition(e.coordinate);
      }
    };
    map.on('singleclick', onSingleClick as any);

    return () => {
      map.un('singleclick', onSingleClick as any);
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      vectorSourceRef.current = null;
      overlayRef.current = null;
    };
  }, [runtime]);

  // Update vector source when map features change
  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) return;

    const geoJson = new GeoJSON();
    const fc = {type: 'FeatureCollection' as const, features: mapFeatures};
    const olFeatures = geoJson.readFeatures(fc, {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
    source.clear();
    source.addFeatures(olFeatures);
  }, [mapFeatures]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return records.find(r => r.record._id === selectedRecordId) ?? null;
  }, [records, selectedRecordId]);

  const selectedFormData = useMemo(() => {
    if (!selectedRecord) return null;
    const out: Record<string, {data: unknown; annotations?: unknown; faimsAttachments?: unknown}> = {};
    for (const [fieldId, avp] of Object.entries(selectedRecord.data ?? {})) {
      out[fieldId] = {
        data: (avp as any).data,
        annotations: (avp as any).annotations,
        faimsAttachments: (avp as any).faimsAttachments,
      };
    }
    return out as unknown as FormUpdateData;
  }, [selectedRecord]);

  const attachmentService: IAttachmentService = useMemo(() => {
    const fail = async () => {
      throw new Error('Attachment service not configured in dashboard view');
    };
    return {
      storeAttachmentFromFile: fail as any,
      storeAttachmentFromBlob: fail as any,
      storeAttachmentFromBase64: fail as any,
      loadAttachmentAsBlob: fail as any,
      loadAttachmentAsFile: fail as any,
      loadAttachmentAsBase64: fail as any,
    };
  }, []);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRecords = useMemo(
    () => records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [records, page]
  );

  const goPrev = useCallback(() => setPage(p => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [totalPages]);

  if (!runtime) {
    return (
      <div className="p-4 text-muted-foreground">
        Loading project…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-sm font-medium hover:bg-accent"
          onClick={onBack}
        >
          ← Back to projects
        </button>
        <h2 className="text-lg font-semibold">Project: {projectId}</h2>
      </div>

      <div
        ref={mapRef}
        className="h-[520px] w-full rounded-md border border-border bg-muted"
        style={{minHeight: 520}}
      >
        <div ref={overlayElRef} className="pointer-events-auto">
          {selectedRecord && (
            <div className="w-[560px] max-w-[90vw] rounded-md border border-border bg-background shadow-lg">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {selectedRecord.hrid || selectedRecord.record._id}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedField ? `Field: ${selectedField}` : selectedRecord.record.formId}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                  onClick={() => {
                    overlayRef.current?.setPosition(undefined);
                    setSelectedRecordId(null);
                    setSelectedField(null);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="flex gap-2 px-3 pt-2">
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs border ${activeTab === 'overview' ? 'bg-accent border-border' : 'border-transparent hover:bg-accent/50'}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 text-xs border ${activeTab === 'details' ? 'bg-accent border-border' : 'border-transparent hover:bg-accent/50'}`}
                  onClick={() => setActiveTab('details')}
                >
                  Details
                </button>
              </div>

              <div className="max-h-[260px] overflow-auto px-3 pb-3 pt-2">
                {activeTab === 'overview' ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Record ID</div>
                      <div className="font-mono break-all">{selectedRecord.record._id}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground">Created</div>
                        <div>{selectedRecord.record.created ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Created by</div>
                        <div className="break-all">{selectedRecord.record.createdBy ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Updated</div>
                        <div>{selectedRecord.revision?.created ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Updated by</div>
                        <div className="break-all">{selectedRecord.revision?.createdBy ?? '—'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Form</div>
                      <div>{selectedRecord.record.formId ?? '—'}</div>
                    </div>
                  </div>
                ) : selectedFormData && uiSpec ? (
                  <div className="text-sm">
                    <DataView
                      viewsetId={selectedRecord.record.formId}
                      uiSpecification={uiSpec as unknown as UISpecification}
                      hydratedRecord={selectedRecord.record as any}
                      hrid={selectedRecord.hrid}
                      formData={selectedFormData}
                      config={{debugMode: false}}
                      trace={[]}
                      tools={{
                        navigateToRecord: () => {},
                        getRecordRoute: () => '#',
                        getDataEngine: () => runtime.engine,
                        getAttachmentService: () => attachmentService,
                        getMapConfig: () => ({mapSource: 'osm', mapSourceKey: '', mapStyle: 'basic'}),
                        editRecordButtonComponent: () => null,
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No details available.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-md border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Records (paginated)</h3>
        {cacheError ? (
          <p className="text-sm text-destructive">
            Failed to hydrate cache: {cacheError}
          </p>
        ) : !cacheReady ? (
          <p className="text-sm text-muted-foreground">Loading cache…</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {records.length} record(s) · page {page + 1} of {totalPages}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 font-medium">HRID</th>
                    <th className="p-2 font-medium">Record ID</th>
                    <th className="p-2 font-medium">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((rec) => (
                    <tr key={rec.record._id} className="border-b border-border/50">
                      <td className="p-2">{rec.hrid ?? '—'}</td>
                      <td className="p-2 font-mono text-xs">{rec.record._id}</td>
                      <td className="p-2">{rec.record.formId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                disabled={page === 0}
                onClick={goPrev}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                disabled={page >= totalPages - 1}
                onClick={goNext}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
