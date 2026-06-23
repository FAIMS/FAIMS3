package exporter

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/faims/faims3/export-service/internal/pb"
)

const (
	batchSize          = 20
	hashSuffixLength   = 6
	maxViewIDLength    = 30
	maxFieldIDLength   = 30
	maxHRIDLength      = 40
	maxCSVNameLength   = 40
	defaultContentType = "application/octet-stream"
)

var csvPrefixHeaders = []string{
	"identifier",
	"record_id",
	"revision_id",
	"type",
	"created_by",
	"created",
	"updated_by",
	"updated",
}

type Config struct {
	CouchDBURL      string
	CouchDBUsername string
	CouchDBPassword string
	SharedSecret    string
}

type Exporter struct {
	couch *couchClient
}

func New(config Config) (*Exporter, error) {
	if config.CouchDBURL == "" {
		config.CouchDBURL = "http://localhost:5984"
	}
	if config.CouchDBUsername == "" {
		config.CouchDBUsername = "admin"
	}
	if config.CouchDBPassword == "" {
		config.CouchDBPassword = "password"
	}

	client, err := newCouchClient(config)
	if err != nil {
		return nil, err
	}
	return &Exporter{couch: client}, nil
}

type Metadata struct {
	Filename    string
	ContentType string
}

func ResponseMetadata(req *pb.ExportRequest) Metadata {
	projectSlug := slugify(req.GetProjectId())
	switch req.GetFormat() {
	case pb.ExportFormat_EXPORT_FORMAT_CSV:
		label := req.GetViewId()
		if label == "" {
			label = projectSlug
		}
		return Metadata{Filename: slugify(label) + "-export.csv", ContentType: "text/csv"}
	case pb.ExportFormat_EXPORT_FORMAT_ZIP:
		label := req.GetViewId()
		if label == "" {
			label = projectSlug
		}
		return Metadata{Filename: slugify(label) + "-photos.zip", ContentType: "application/zip"}
	case pb.ExportFormat_EXPORT_FORMAT_GEOJSON:
		return Metadata{Filename: projectSlug + "-export.geojson", ContentType: "application/geo+json"}
	case pb.ExportFormat_EXPORT_FORMAT_KML:
		return Metadata{Filename: projectSlug + "-export.kml", ContentType: "application/vnd.google-earth.kml+xml"}
	case pb.ExportFormat_EXPORT_FORMAT_FULL:
		return Metadata{
			Filename:    fmt.Sprintf("%s-export-%s.zip", slugifyLabel(req.GetProjectId(), 50), time.Now().UTC().Format("2006-01-02")),
			ContentType: "application/zip",
		}
	case pb.ExportFormat_EXPORT_FORMAT_JSON_RECORDS:
		return Metadata{Filename: "records.json", ContentType: "application/json"}
	default:
		return Metadata{Filename: "export.bin", ContentType: defaultContentType}
	}
}

func (e *Exporter) Export(ctx context.Context, req *pb.ExportRequest, out io.Writer) error {
	if req.GetProjectId() == "" {
		return invalidArgumentf("project_id is required")
	}

	ec, err := e.loadContext(ctx, req.GetProjectId())
	if err != nil {
		return err
	}

	switch req.GetFormat() {
	case pb.ExportFormat_EXPORT_FORMAT_CSV:
		if req.GetViewId() == "" {
			return invalidArgumentf("view_id is required for CSV export")
		}
		return e.writeCSV(ctx, ec, req.GetViewId(), out)
	case pb.ExportFormat_EXPORT_FORMAT_ZIP:
		return e.writeAttachmentZip(ctx, ec, req.GetViewId(), out)
	case pb.ExportFormat_EXPORT_FORMAT_GEOJSON:
		return e.writeGeoJSON(ctx, ec, out)
	case pb.ExportFormat_EXPORT_FORMAT_KML:
		return e.writeKML(ctx, ec, out)
	case pb.ExportFormat_EXPORT_FORMAT_FULL:
		return e.writeFullZip(ctx, ec, req.GetUserId(), normalizeFullConfig(req.GetFullConfig()), out)
	case pb.ExportFormat_EXPORT_FORMAT_JSON_RECORDS:
		return e.writeJSONRecords(ctx, ec, out)
	default:
		return invalidArgumentf("unsupported export format: %s", req.GetFormat().String())
	}
}

type fullConfig struct {
	IncludeTabular     bool `json:"includeTabular"`
	IncludeAttachments bool `json:"includeAttachments"`
	IncludeGeoJSON     bool `json:"includeGeoJSON"`
	IncludeKML         bool `json:"includeKML"`
	IncludeMetadata    bool `json:"includeMetadata"`
}

func normalizeFullConfig(config *pb.FullExportConfig) fullConfig {
	if config == nil {
		return fullConfig{
			IncludeTabular:     true,
			IncludeAttachments: true,
			IncludeGeoJSON:     true,
			IncludeKML:         true,
			IncludeMetadata:    true,
		}
	}
	return fullConfig{
		IncludeTabular:     config.GetIncludeTabular(),
		IncludeAttachments: config.GetIncludeAttachments(),
		IncludeGeoJSON:     config.GetIncludeGeojson(),
		IncludeKML:         config.GetIncludeKml(),
		IncludeMetadata:    config.GetIncludeMetadata(),
	}
}

type exportContext struct {
	ProjectID string
	DataDB    string
	UISpec    uiSpec
}

func (e *Exporter) loadContext(ctx context.Context, projectID string) (*exportContext, error) {
	project, err := e.couch.getProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	dataDB := project.dataDBName()
	if dataDB == "" {
		return nil, notFoundf("project %s does not contain dataDb.db_name", projectID)
	}
	ui := project.uiSpec()
	if len(ui.Viewsets) == 0 {
		return nil, notFoundf("project %s does not contain a usable uiSpecification.uiSpec", projectID)
	}
	return &exportContext{ProjectID: projectID, DataDB: dataDB, UISpec: ui}, nil
}

func (e *Exporter) writeCSV(ctx context.Context, ec *exportContext, viewID string, out io.Writer) error {
	fields, err := fieldsForViewset(ec.UISpec, viewID)
	if err != nil {
		return err
	}

	writer := csv.NewWriter(out)
	headers := append([]string{}, csvPrefixHeaders...)
	headers = append(headers, headersForFields(fields)...)
	if err := writer.Write(headers); err != nil {
		return err
	}

	filenames := map[string]struct{}{}
	err = e.iterateRecords(ctx, ec, viewID, func(record *hydratedRecord) error {
		if err := e.stripDeletedRelatedRefs(ctx, ec, record.Type, record.Data); err != nil {
			return err
		}
		row, rowErr := csvRow(record, fields, headers[len(csvPrefixHeaders):], filenames)
		if rowErr != nil {
			return rowErr
		}
		return writer.Write(row)
	})
	if err != nil {
		return err
	}
	writer.Flush()
	return writer.Error()
}

func (e *Exporter) writeAttachmentZip(ctx context.Context, ec *exportContext, viewID string, out io.Writer) error {
	zipWriter := zip.NewWriter(out)
	_, err := e.appendAttachmentsToZip(ctx, ec, zipWriter, viewID, "")
	closeErr := zipWriter.Close()
	if err != nil {
		return err
	}
	return closeErr
}

type jsonExportRecord struct {
	ProjectID    string                 `json:"project_id"`
	RecordID     string                 `json:"record_id"`
	RevisionID   string                 `json:"revision_id"`
	CreatedBy    string                 `json:"created_by"`
	Updated      time.Time              `json:"updated"`
	UpdatedBy    string                 `json:"updated_by"`
	Deleted      bool                   `json:"deleted"`
	HRID         string                 `json:"hrid,omitempty"`
	Relationship any                    `json:"relationship,omitempty"`
	Data         map[string]any         `json:"data"`
	Annotations  map[string]annotations `json:"annotations"`
	Types        map[string]string      `json:"types"`
	Created      time.Time              `json:"created"`
	Conflicts    bool                   `json:"conflicts"`
	Type         string                 `json:"type"`
}

func (e *Exporter) writeJSONRecords(ctx context.Context, ec *exportContext, out io.Writer) error {
	records := []jsonExportRecord{}
	filenames := map[string]struct{}{}

	err := e.iterateRecords(ctx, ec, "", func(record *hydratedRecord) error {
		if err := e.stripDeletedRelatedRefs(ctx, ec, record.Type, record.Data); err != nil {
			return err
		}
		rewriteAttachmentFieldsForJSON(ec.UISpec, record, filenames)
		records = append(records, jsonExportRecord{
			ProjectID:    record.ProjectID,
			RecordID:     record.RecordID,
			RevisionID:   record.RevisionID,
			CreatedBy:    record.CreatedBy,
			Updated:      record.Updated,
			UpdatedBy:    record.UpdatedBy,
			Deleted:      record.Deleted,
			HRID:         record.HRID,
			Relationship: record.Relationship,
			Data:         record.Data,
			Annotations:  record.Annotations,
			Types:        record.Types,
			Created:      record.Created,
			Conflicts:    record.Conflicts,
			Type:         record.Type,
		})
		return nil
	})
	if err != nil {
		return err
	}

	payload, err := json.Marshal(map[string]any{"records": records})
	if err != nil {
		return err
	}
	_, err = out.Write(payload)
	return err
}

func rewriteAttachmentFieldsForJSON(spec uiSpec, record *hydratedRecord, filenames map[string]struct{}) {
	for fieldID, value := range record.Data {
		if !isAttachmentField(spec, fieldID, record.Types[fieldID]) {
			continue
		}
		attachments := parseAttachmentRefs(value)
		if len(attachments) == 0 {
			continue
		}
		viewsetID := record.Type
		if ids := fieldViewsetID(spec, fieldID); ids != "" {
			viewsetID = ids
		}
		names := make([]string, 0, len(attachments))
		for _, attachment := range attachments {
			names = append(names, attachmentFilename(viewsetID, fieldID, record.hridOrID(), attachment.FileType, filenames))
		}
		record.Data[fieldID] = names
	}
}

func fieldViewsetID(spec uiSpec, fieldName string) string {
	for viewsetID, viewset := range spec.Viewsets {
		for _, viewID := range viewset.Views {
			view, ok := spec.Views[viewID]
			if !ok {
				continue
			}
			for _, name := range view.Fields {
				if name == fieldName {
					return viewsetID
				}
			}
		}
	}
	return ""
}

type fullMetadata struct {
	ProjectID     string       `json:"projectId"`
	ExportedAt    string       `json:"exportedAt"`
	ExportedBy    string       `json:"exportedBy"`
	Config        fullConfig   `json:"config"`
	Views         []viewMeta   `json:"views"`
	Totals        exportTotals `json:"totals"`
	IncludedFiles []string     `json:"includedFiles"`
	Warnings      []string     `json:"warnings"`
}

type viewMeta struct {
	ViewID          string `json:"viewId"`
	Label           string `json:"label"`
	RecordCount     int    `json:"recordCount"`
	AttachmentCount int    `json:"attachmentCount"`
	CSVPath         string `json:"csvPath,omitempty"`
	AttachmentPath  string `json:"attachmentPath,omitempty"`
}

type exportTotals struct {
	Views           int `json:"views"`
	Records         int `json:"records"`
	Attachments     int `json:"attachments"`
	SpatialFeatures int `json:"spatialFeatures"`
}

func (e *Exporter) writeFullZip(ctx context.Context, ec *exportContext, userID string, config fullConfig, out io.Writer) error {
	zipWriter := zip.NewWriter(out)
	metadata := fullMetadata{
		ProjectID:  ec.ProjectID,
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		ExportedBy: userID,
		Config:     config,
		Totals: exportTotals{
			Views: len(ec.UISpec.Viewsets),
		},
	}

	viewIDs := sortedViewsetIDs(ec.UISpec)
	viewMetaByID := map[string]*viewMeta{}
	for _, viewID := range viewIDs {
		viewset := ec.UISpec.Viewsets[viewID]
		entry := &viewMeta{ViewID: viewID, Label: viewLabel(viewID, viewset)}
		metadata.Views = append(metadata.Views, *entry)
		viewMetaByID[viewID] = &metadata.Views[len(metadata.Views)-1]
	}

	if config.IncludeTabular {
		usedCSVNames := map[string]struct{}{}
		for _, viewID := range viewIDs {
			viewset := ec.UISpec.Viewsets[viewID]
			filename := uniqueName("records/"+truncateWithHash(slugify(viewLabel(viewID, viewset)), maxCSVNameLength), "csv", usedCSVNames)
			entry, err := zipWriter.Create(filename)
			if err != nil {
				return err
			}
			count, err := e.writeCSVEntry(ctx, ec, viewID, entry)
			if err != nil {
				metadata.Warnings = append(metadata.Warnings, fmt.Sprintf("Failed to export CSV for %s: %v", viewID, err))
				continue
			}
			viewMetaByID[viewID].RecordCount = count
			viewMetaByID[viewID].CSVPath = filename
			metadata.Totals.Records += count
			metadata.IncludedFiles = append(metadata.IncludedFiles, filename)
		}
	}

	if config.IncludeAttachments {
		attachmentStats, err := e.appendAttachmentsToZip(ctx, ec, zipWriter, "", "attachments/")
		if err != nil {
			metadata.Warnings = append(metadata.Warnings, fmt.Sprintf("Failed to export attachments: %v", err))
		} else {
			metadata.Totals.Attachments = attachmentStats.Total
			for viewID, count := range attachmentStats.ByView {
				if entry, ok := viewMetaByID[viewID]; ok {
					entry.AttachmentCount = count
					if count > 0 {
						entry.AttachmentPath = "attachments/" + viewID + "/"
						metadata.IncludedFiles = append(metadata.IncludedFiles, entry.AttachmentPath)
					}
				}
			}
		}
	}

	if config.IncludeGeoJSON {
		entry, err := zipWriter.Create("spatial/export.geojson")
		if err != nil {
			return err
		}
		count, err := e.writeSpatial(ctx, ec, entry, spatialGeoJSON)
		if err != nil {
			metadata.Warnings = append(metadata.Warnings, fmt.Sprintf("Failed to export GeoJSON: %v", err))
		} else {
			metadata.Totals.SpatialFeatures = max(metadata.Totals.SpatialFeatures, count)
			metadata.IncludedFiles = append(metadata.IncludedFiles, "spatial/export.geojson")
		}
	}

	if config.IncludeKML {
		entry, err := zipWriter.Create("spatial/export.kml")
		if err != nil {
			return err
		}
		count, err := e.writeSpatial(ctx, ec, entry, spatialKML)
		if err != nil {
			metadata.Warnings = append(metadata.Warnings, fmt.Sprintf("Failed to export KML: %v", err))
		} else {
			metadata.Totals.SpatialFeatures = max(metadata.Totals.SpatialFeatures, count)
			metadata.IncludedFiles = append(metadata.IncludedFiles, "spatial/export.kml")
		}
	}

	if config.IncludeMetadata {
		entry, err := zipWriter.Create("ro-crate-metadata.json")
		if err != nil {
			return err
		}
		encoded, err := json.MarshalIndent(roCrate(metadata), "", "  ")
		if err != nil {
			return err
		}
		if _, err := entry.Write(encoded); err != nil {
			return err
		}
	}

	return zipWriter.Close()
}

func (e *Exporter) writeCSVEntry(ctx context.Context, ec *exportContext, viewID string, out io.Writer) (int, error) {
	fields, err := fieldsForViewset(ec.UISpec, viewID)
	if err != nil {
		return 0, err
	}
	writer := csv.NewWriter(out)
	headers := append([]string{}, csvPrefixHeaders...)
	headers = append(headers, headersForFields(fields)...)
	if err := writer.Write(headers); err != nil {
		return 0, err
	}
	filenames := map[string]struct{}{}
	count := 0
	err = e.iterateRecords(ctx, ec, viewID, func(record *hydratedRecord) error {
		if err := e.stripDeletedRelatedRefs(ctx, ec, record.Type, record.Data); err != nil {
			return err
		}
		row, rowErr := csvRow(record, fields, headers[len(csvPrefixHeaders):], filenames)
		if rowErr != nil {
			return rowErr
		}
		if err := writer.Write(row); err != nil {
			return err
		}
		count++
		return nil
	})
	writer.Flush()
	if err != nil {
		return count, err
	}
	return count, writer.Error()
}

type attachmentStats struct {
	Total  int
	ByView map[string]int
}

func (e *Exporter) appendAttachmentsToZip(ctx context.Context, ec *exportContext, zipWriter *zip.Writer, viewID string, prefix string) (attachmentStats, error) {
	stats := attachmentStats{ByView: map[string]int{}}
	filenames := map[string]struct{}{}

	err := e.iterateRecords(ctx, ec, viewID, func(record *hydratedRecord) error {
		for fieldID, value := range record.Data {
			if !isAttachmentField(ec.UISpec, fieldID, record.Types[fieldID]) {
				continue
			}
			attachments := parseAttachmentRefs(value)
			for _, attachment := range attachments {
				filename := attachmentFilename(record.Type, fieldID, record.hridOrID(), attachment.FileType, filenames)
				fullFilename := prefix + filename
				w, err := zipWriter.Create(fullFilename)
				if err != nil {
					return err
				}
				if err := e.couch.getAttachment(ctx, ec.DataDB, attachment.AttachmentID, attachment.AttachmentID, w); err != nil {
					return err
				}
				stats.Total++
				stats.ByView[record.Type]++
			}
		}
		return nil
	})

	return stats, err
}

func (e *Exporter) writeGeoJSON(ctx context.Context, ec *exportContext, out io.Writer) error {
	_, err := e.writeSpatial(ctx, ec, out, spatialGeoJSON)
	return err
}

func (e *Exporter) writeKML(ctx context.Context, ec *exportContext, out io.Writer) error {
	_, err := e.writeSpatial(ctx, ec, out, spatialKML)
	return err
}

type spatialFormat int

const (
	spatialGeoJSON spatialFormat = iota
	spatialKML
)

func (e *Exporter) writeSpatial(ctx context.Context, ec *exportContext, out io.Writer, format spatialFormat) (int, error) {
	spatialFields := spatialFieldsByViewset(ec.UISpec)
	if len(spatialFields) == 0 {
		if format == spatialGeoJSON {
			_, _ = io.WriteString(out, `{"type":"FeatureCollection","features":[]}`)
		} else {
			_, _ = io.WriteString(out, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>`)
		}
		return 0, nil
	}

	if format == spatialGeoJSON {
		_, _ = io.WriteString(out, `{"type":"FeatureCollection","features":[`)
	} else {
		_, _ = io.WriteString(out, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>`)
	}

	filenames := map[string]struct{}{}
	first := true
	count := 0
	err := e.iterateRecords(ctx, ec, "", func(record *hydratedRecord) error {
		fields := spatialFields[record.Type]
		if len(fields) == 0 {
			return nil
		}
		if err := e.stripDeletedRelatedRefs(ctx, ec, record.Type, record.Data); err != nil {
			return err
		}
		properties := record.baseProperties()
		ObjectAssign(properties, convertedData(fieldsForProperties(ec.UISpec, record.Type), record.Data, record.Annotations, record.hridOrID(), filenames, record.Type))

		for _, field := range fields {
			value, ok := record.Data[field.Name]
			if !ok || value == nil || value == "" {
				continue
			}
			feature, ok := extractFeature(value)
			if !ok {
				continue
			}
			props := cloneMap(properties)
			props["geometry_source_view_id"] = field.ViewID
			props["geometry_source_viewset_id"] = field.ViewsetID
			props["geometry_source_field_id"] = field.Name
			props["geometry_source_type"] = field.Type

			if format == spatialGeoJSON {
				if !first {
					_, _ = io.WriteString(out, ",")
				}
				first = false
				payload := map[string]any{
					"type":       "Feature",
					"geometry":   feature.Geometry,
					"properties": props,
				}
				encoded, err := json.Marshal(payload)
				if err != nil {
					return err
				}
				if _, err := out.Write(encoded); err != nil {
					return err
				}
			} else {
				if err := writePlacemark(out, record.hridOrID(), feature.Geometry, props); err != nil {
					return err
				}
			}
			count++
		}
		return nil
	})

	if format == spatialGeoJSON {
		_, _ = io.WriteString(out, `]}`)
	} else {
		_, _ = io.WriteString(out, `</Document></kml>`)
	}
	return count, err
}

func (e *Exporter) iterateRecords(ctx context.Context, ec *exportContext, viewID string, fn func(*hydratedRecord) error) error {
	var bookmark string
	for {
		rows, err := e.couch.recordRevisionRows(ctx, ec.DataDB, bookmark)
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		bookmark = rows[len(rows)-1].ID

		matched := false
		for _, row := range rows {
			if row.Doc.Deleted {
				continue
			}
			if viewID != "" && row.Value.Type != viewID {
				continue
			}
			matched = true
			record, err := e.hydrateRecord(ctx, ec, row)
			if err != nil {
				return err
			}
			if err := fn(record); err != nil {
				return err
			}
		}
		if !matched && len(rows) < batchSize {
			return nil
		}
	}
}

func (e *Exporter) hydrateRecord(ctx context.Context, ec *exportContext, row recordRevisionRow) (*hydratedRecord, error) {
	avpIDs := make([]string, 0, len(row.Doc.AVPs))
	for _, avpID := range row.Doc.AVPs {
		avpIDs = append(avpIDs, avpID)
	}
	avps, err := e.couch.avps(ctx, ec.DataDB, avpIDs)
	if err != nil {
		return nil, err
	}

	record := &hydratedRecord{
		ProjectID:    ec.ProjectID,
		RecordID:     row.ID,
		RevisionID:   row.Doc.ID,
		CreatedBy:    row.Value.CreatedBy,
		UpdatedBy:    row.Doc.CreatedBy,
		Deleted:      row.Doc.Deleted,
		Relationship: row.Doc.Relationship,
		Type:         row.Doc.Type,
		Data:         map[string]any{},
		Annotations:  map[string]annotations{},
		Types:        map[string]string{},
		Conflicts:    row.Value.Conflict,
		Created:      parseCouchTime(row.Value.Created),
		Updated:      parseCouchTimeString(row.Doc.Created),
	}

	for fieldName, avpID := range row.Doc.AVPs {
		avp, ok := avps[avpID]
		if !ok {
			continue
		}
		record.Data[fieldName] = avp.Data
		record.Annotations[fieldName] = avp.Annotations
		record.Types[fieldName] = avp.Type
	}
	record.HRID = hridForRecord(ec.UISpec, row.Doc, record.Data)
	return record, nil
}

type hydratedRecord struct {
	ProjectID    string
	RecordID     string
	RevisionID   string
	CreatedBy    string
	Updated      time.Time
	UpdatedBy    string
	Deleted      bool
	HRID         string
	Relationship any
	Data         map[string]any
	Annotations  map[string]annotations
	Types        map[string]string
	Created      time.Time
	Conflicts    bool
	Type         string
}

func (r hydratedRecord) hridOrID() string {
	if r.HRID != "" {
		return r.HRID
	}
	return r.RecordID
}

func (r hydratedRecord) baseProperties() map[string]any {
	return map[string]any{
		"hrid":         r.hridOrID(),
		"record_id":    r.RecordID,
		"revision_id":  r.RevisionID,
		"type":         r.Type,
		"created_by":   r.CreatedBy,
		"created_time": r.Created.Format(time.RFC3339),
		"updated_by":   r.UpdatedBy,
		"updated_time": r.Updated.Format(time.RFC3339),
	}
}

func csvRow(record *hydratedRecord, fields []fieldSummary, dataHeaders []string, filenames map[string]struct{}) ([]string, error) {
	row := []string{
		record.hridOrID(),
		record.RecordID,
		record.RevisionID,
		record.Type,
		record.CreatedBy,
		record.Created.Format(time.RFC3339),
		record.UpdatedBy,
		record.Updated.Format(time.RFC3339),
	}

	output := convertedData(fields, record.Data, record.Annotations, record.hridOrID(), filenames, record.Type)
	for _, header := range dataHeaders {
		row = append(row, csvCell(output[header]))
	}
	return row, nil
}

func csvCell(value any) string {
	text := valueToString(value)
	if text == "" {
		return ""
	}
	switch text[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + text
	default:
		return text
	}
}

func convertedData(fields []fieldSummary, data map[string]any, annotationsByField map[string]annotations, hrid string, filenames map[string]struct{}, viewsetID string) map[string]any {
	result := map[string]any{}
	for _, field := range fields {
		value, ok := data[field.Name]
		if !ok {
			continue
		}
		ObjectAssign(result, formatValue(field, value, hrid, filenames, viewsetID))
		if ann, ok := annotationsByField[field.Name]; ok {
			if field.Annotation != "" {
				result[field.Name+"_"+field.Annotation] = ann.Annotation
			}
			if field.Uncertainty != "" {
				if ann.Uncertainty {
					result[field.Name+"_"+field.Uncertainty] = "true"
				} else {
					result[field.Name+"_"+field.Uncertainty] = "false"
				}
			}
		}
	}
	return result
}

func formatValue(field fieldSummary, value any, hrid string, filenames map[string]struct{}, viewsetID string) map[string]any {
	result := map[string]any{}
	key := componentKey(field.ComponentNamespace, field.ComponentName)
	switch key {
	case "faims-custom::TakePhoto", "faims-custom::FileUploader":
		attachments := parseAttachmentRefs(value)
		names := make([]string, 0, len(attachments))
		for _, attachment := range attachments {
			names = append(names, attachmentFilename(viewsetID, field.Name, hrid, attachment.FileType, filenames))
		}
		result[field.Name] = strings.Join(names, ";")
	case "faims-custom::TakePoint":
		result[field.Name] = value
		result[field.Name+"_latitude"] = ""
		result[field.Name+"_longitude"] = ""
		result[field.Name+"_accuracy"] = ""
		if feature, ok := extractFeature(value); ok {
			if coords := pointCoordinates(feature.Geometry); len(coords) == 2 {
				result[field.Name+"_latitude"] = coords[1]
				result[field.Name+"_longitude"] = coords[0]
			}
			if feature.Properties != nil {
				if accuracy, ok := feature.Properties["accuracy"]; ok {
					result[field.Name+"_accuracy"] = accuracy
				}
			}
		}
	case "faims-custom::AddressField":
		obj, _ := value.(map[string]any)
		display, _ := obj["display_name"].(string)
		if display == "" {
			display, _ = obj["manuallyEnteredAddress"].(string)
		}
		result[field.Name] = display
		address, _ := obj["address"].(map[string]any)
		for _, part := range []string{"house_number", "road", "suburb", "town", "state", "postcode", "country", "country_code"} {
			result[field.Name+"_"+part] = address[part]
		}
		result[field.Name+"_manual"], _ = obj["manuallyEnteredAddress"].(string)
	case "mapping-plugin::MapFormField":
		result[field.Name] = value
		result[field.Name+"_latitude"] = ""
		result[field.Name+"_longitude"] = ""
		if feature, ok := extractFeature(value); ok {
			if coords := pointCoordinates(feature.Geometry); len(coords) == 2 {
				result[field.Name+"_latitude"] = coords[1]
				result[field.Name+"_longitude"] = coords[0]
			}
		}
	case "faims-custom::RelatedRecordSelector":
		items, ok := value.([]any)
		if !ok {
			result[field.Name] = value
			break
		}
		parts := make([]string, 0, len(items))
		for _, item := range items {
			obj, _ := item.(map[string]any)
			relation := "unknown relation"
			if pair, ok := obj["relation_type_vocabPair"].([]any); ok && len(pair) > 0 {
				relation = valueToString(pair[0])
			}
			parts = append(parts, relation+"/"+valueToString(obj["record_id"]))
		}
		result[field.Name] = strings.Join(parts, ";")
	default:
		result[field.Name] = value
	}
	return result
}

func headersForFields(fields []fieldSummary) []string {
	headers := []string{}
	for _, field := range fields {
		switch componentKey(field.ComponentNamespace, field.ComponentName) {
		case "faims-custom::TakePoint":
			headers = append(headers, field.Name, field.Name+"_latitude", field.Name+"_longitude", field.Name+"_accuracy")
		case "faims-custom::AddressField":
			headers = append(headers, field.Name, field.Name+"_house_number", field.Name+"_road", field.Name+"_suburb", field.Name+"_town", field.Name+"_state", field.Name+"_postcode", field.Name+"_country", field.Name+"_country_code", field.Name+"_manual")
		case "mapping-plugin::MapFormField":
			headers = append(headers, field.Name, field.Name+"_latitude", field.Name+"_longitude")
		default:
			headers = append(headers, field.Name)
		}
		if field.Annotation != "" {
			headers = append(headers, field.Name+"_"+field.Annotation)
		}
		if field.Uncertainty != "" {
			headers = append(headers, field.Name+"_"+field.Uncertainty)
		}
	}
	return headers
}

type attachmentRef struct {
	AttachmentID string `json:"attachment_id"`
	Filename     string `json:"filename"`
	FileType     string `json:"file_type"`
}

func parseAttachmentRefs(value any) []attachmentRef {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	refs := []attachmentRef{}
	for _, item := range items {
		obj, ok := item.(map[string]any)
		if !ok {
			continue
		}
		ref := attachmentRef{
			AttachmentID: valueToString(obj["attachment_id"]),
			Filename:     valueToString(obj["filename"]),
			FileType:     valueToString(obj["file_type"]),
		}
		if ref.AttachmentID != "" {
			refs = append(refs, ref)
		}
	}
	return refs
}

func attachmentFilename(viewID, fieldID, hrid, mimeType string, existing map[string]struct{}) string {
	extension := extensionForMIME(mimeType)
	base := strings.Join([]string{
		truncateWithHash(slugify(viewID), maxViewIDLength),
		truncateWithHash(slugify(fieldID), maxFieldIDLength),
		truncateWithHash(slugify(hrid), maxHRIDLength),
	}, "/")

	filename := base + "." + extension
	for i := 1; ; i++ {
		if _, ok := existing[filename]; !ok {
			existing[filename] = struct{}{}
			return filename
		}
		filename = fmt.Sprintf("%s_%d.%s", base, i, extension)
	}
}

func extensionForMIME(raw string) string {
	raw = strings.TrimSpace(strings.Split(raw, ";")[0])
	mapping := map[string]string{
		"image/jpeg":       "jpg",
		"image/png":        "png",
		"image/gif":        "gif",
		"image/tiff":       "tif",
		"text/plain":       "txt",
		"application/pdf":  "pdf",
		"application/json": "json",
		"audio/mp4":        "m4a",
		"audio/webm":       "webm",
		"audio/ogg":        "ogg",
		"audio/mpeg":       "mp3",
		"audio/wav":        "wav",
	}
	if ext, ok := mapping[raw]; ok {
		return ext
	}
	if exts, _ := mime.ExtensionsByType(raw); len(exts) > 0 {
		return strings.TrimPrefix(exts[0], ".")
	}
	return "dat"
}

type geometryFeature struct {
	Type       string
	Geometry   map[string]any
	Properties map[string]any
}

func extractFeature(value any) (geometryFeature, bool) {
	obj, ok := value.(map[string]any)
	if !ok {
		return geometryFeature{}, false
	}

	if obj["type"] == "FeatureCollection" {
		features, ok := obj["features"].([]any)
		if !ok || len(features) == 0 {
			return geometryFeature{}, false
		}
		obj, ok = features[0].(map[string]any)
		if !ok {
			return geometryFeature{}, false
		}
	}

	if obj["type"] != "Feature" {
		return geometryFeature{}, false
	}
	geometry, ok := obj["geometry"].(map[string]any)
	if !ok || geometry["coordinates"] == nil {
		return geometryFeature{}, false
	}
	properties, _ := obj["properties"].(map[string]any)
	return geometryFeature{Type: "Feature", Geometry: geometry, Properties: properties}, true
}

func pointCoordinates(geometry map[string]any) []float64 {
	if geometry["type"] != "Point" {
		return nil
	}
	raw, ok := geometry["coordinates"].([]any)
	if !ok || len(raw) < 2 {
		return nil
	}
	x, xOK := asFloat(raw[0])
	y, yOK := asFloat(raw[1])
	if !xOK || !yOK {
		return nil
	}
	return []float64{x, y}
}

func writePlacemark(out io.Writer, name string, geometry map[string]any, properties map[string]any) error {
	_, _ = io.WriteString(out, "<Placemark><name>")
	if err := xml.EscapeText(out, []byte(name)); err != nil {
		return err
	}
	_, _ = io.WriteString(out, "</name><ExtendedData>")
	keys := make([]string, 0, len(properties))
	for key := range properties {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		_, _ = io.WriteString(out, `<Data name="`)
		if err := xml.EscapeText(out, []byte(key)); err != nil {
			return err
		}
		_, _ = io.WriteString(out, `"><value>`)
		if err := xml.EscapeText(out, []byte(valueToString(properties[key]))); err != nil {
			return err
		}
		_, _ = io.WriteString(out, "</value></Data>")
	}
	_, _ = io.WriteString(out, "</ExtendedData>")
	kml, err := geometryToKML(geometry)
	if err != nil {
		return err
	}
	_, _ = io.WriteString(out, kml)
	_, _ = io.WriteString(out, "</Placemark>")
	return nil
}

func geometryToKML(geometry map[string]any) (string, error) {
	typ, _ := geometry["type"].(string)
	coords := geometry["coordinates"]
	switch typ {
	case "Point":
		return "<Point><coordinates>" + formatCoords(coords) + "</coordinates></Point>", nil
	case "LineString":
		return "<LineString><coordinates>" + formatCoords(coords) + "</coordinates></LineString>", nil
	case "Polygon":
		return polygonKML(coords), nil
	case "MultiPoint":
		return multiKML(coords, "Point"), nil
	case "MultiLineString":
		return multiKML(coords, "LineString"), nil
	case "MultiPolygon":
		items, _ := coords.([]any)
		var b strings.Builder
		b.WriteString("<MultiGeometry>")
		for _, item := range items {
			b.WriteString(polygonKML(item))
		}
		b.WriteString("</MultiGeometry>")
		return b.String(), nil
	default:
		return "", fmt.Errorf("unsupported geometry type: %s", typ)
	}
}

func formatCoords(value any) string {
	items, ok := value.([]any)
	if !ok {
		return valueToString(value)
	}
	if len(items) > 0 {
		if _, ok := asFloat(items[0]); ok {
			parts := make([]string, len(items))
			for i, item := range items {
				parts[i] = valueToString(item)
			}
			if len(parts) == 2 {
				parts = append(parts, "0")
			}
			return strings.Join(parts, ",")
		}
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, formatCoords(item))
	}
	return strings.Join(parts, " ")
}

func polygonKML(value any) string {
	rings, _ := value.([]any)
	if len(rings) == 0 {
		return "<Polygon></Polygon>"
	}
	var b strings.Builder
	b.WriteString("<Polygon><outerBoundaryIs><LinearRing><coordinates>")
	b.WriteString(formatCoords(rings[0]))
	b.WriteString("</coordinates></LinearRing></outerBoundaryIs>")
	for _, ring := range rings[1:] {
		b.WriteString("<innerBoundaryIs><LinearRing><coordinates>")
		b.WriteString(formatCoords(ring))
		b.WriteString("</coordinates></LinearRing></innerBoundaryIs>")
	}
	b.WriteString("</Polygon>")
	return b.String()
}

func multiKML(value any, element string) string {
	items, _ := value.([]any)
	var b strings.Builder
	b.WriteString("<MultiGeometry>")
	for _, item := range items {
		b.WriteString("<")
		b.WriteString(element)
		b.WriteString("><coordinates>")
		b.WriteString(formatCoords(item))
		b.WriteString("</coordinates></")
		b.WriteString(element)
		b.WriteString(">")
	}
	b.WriteString("</MultiGeometry>")
	return b.String()
}

type uiSpec struct {
	Fields   map[string]fieldDef   `json:"fields"`
	Views    map[string]viewDef    `json:"views"`
	Viewsets map[string]viewsetDef `json:"viewsets"`
}

type fieldDef struct {
	ComponentNamespace  string          `json:"component-namespace"`
	ComponentName       string          `json:"component-name"`
	TypeReturned        string          `json:"type-returned"`
	Meta                fieldMeta       `json:"meta"`
	ComponentParameters json.RawMessage `json:"component-parameters"`
}

type fieldMeta struct {
	Annotation  metaFlag `json:"annotation"`
	Uncertainty metaFlag `json:"uncertainty"`
}

type metaFlag struct {
	Include bool   `json:"include"`
	Label   string `json:"label"`
}

type viewDef struct {
	Fields []string `json:"fields"`
}

type viewsetDef struct {
	Label         string   `json:"label"`
	Views         []string `json:"views"`
	HRIDField     string   `json:"hridField"`
	SummaryFields []string `json:"summary_fields"`
}

type fieldSummary struct {
	Name               string
	Type               string
	ComponentNamespace string
	ComponentName      string
	Annotation         string
	ViewID             string
	ViewsetID          string
	Uncertainty        string
	IsSpatial          bool
}

func fieldsForViewset(spec uiSpec, viewsetID string) ([]fieldSummary, error) {
	viewset, ok := spec.Viewsets[viewsetID]
	if !ok {
		return nil, invalidArgumentf("invalid form %s not found in notebook", viewsetID)
	}
	fields := []fieldSummary{}
	for _, viewID := range viewset.Views {
		view, ok := spec.Views[viewID]
		if !ok {
			continue
		}
		for _, fieldName := range view.Fields {
			fieldInfo, ok := spec.Fields[fieldName]
			if !ok {
				continue
			}
			fields = append(fields, fieldSummary{
				Name:               fieldName,
				Type:               fieldInfo.TypeReturned,
				ComponentNamespace: fieldInfo.ComponentNamespace,
				ComponentName:      fieldInfo.ComponentName,
				Annotation:         labelSlug(fieldInfo.Meta.Annotation),
				Uncertainty:        labelSlug(fieldInfo.Meta.Uncertainty),
				ViewID:             viewID,
				ViewsetID:          viewsetID,
				IsSpatial:          fieldInfo.ComponentName == "MapFormField" || fieldInfo.ComponentName == "TakePoint",
			})
		}
	}
	return fields, nil
}

func fieldsForProperties(spec uiSpec, viewsetID string) []fieldSummary {
	fields, err := fieldsForViewset(spec, viewsetID)
	if err != nil {
		return nil
	}
	return fields
}

func spatialFieldsByViewset(spec uiSpec) map[string][]fieldSummary {
	result := map[string][]fieldSummary{}
	for viewsetID := range spec.Viewsets {
		fields, err := fieldsForViewset(spec, viewsetID)
		if err != nil {
			continue
		}
		for _, field := range fields {
			if field.IsSpatial {
				result[viewsetID] = append(result[viewsetID], field)
			}
		}
	}
	return result
}

func labelSlug(flag metaFlag) string {
	if !flag.Include {
		return ""
	}
	return slugify(flag.Label)
}

func componentKey(namespace, name string) string {
	if namespace == "" {
		return name
	}
	return namespace + "::" + name
}

var attachmentComponents = map[string]struct{}{
	"faims-custom::TakePhoto":    {},
	"faims-custom::FileUploader": {},
}

func isAttachmentField(spec uiSpec, fieldID, avpType string) bool {
	if avpType == "faims-attachment::Files" {
		return true
	}
	field, ok := spec.Fields[fieldID]
	if !ok {
		return false
	}
	_, ok = attachmentComponents[componentKey(field.ComponentNamespace, field.ComponentName)]
	return ok
}

func hridForRecord(spec uiSpec, revision revisionDoc, data map[string]any) string {
	if viewset, ok := spec.Viewsets[revision.Type]; ok {
		if field := hridFieldName(spec, revision.Type, viewset); field != "" {
			return valueToString(data[field])
		}
	}
	for fieldName := range revision.AVPs {
		if strings.HasPrefix(fieldName, "hrid") {
			return valueToString(data[fieldName])
		}
	}
	return ""
}

func hridFieldName(spec uiSpec, viewsetID string, viewset viewsetDef) string {
	if viewset.HRIDField != "" {
		return viewset.HRIDField
	}
	for _, viewID := range viewset.Views {
		view := spec.Views[viewID]
		for _, fieldName := range view.Fields {
			if strings.HasPrefix(fieldName, "hrid") {
				return fieldName
			}
		}
	}
	return ""
}

type couchClient struct {
	baseURL  string
	username string
	password string
	client   *http.Client
}

func newCouchClient(config Config) (*couchClient, error) {
	base := strings.TrimRight(config.CouchDBURL, "/")
	if _, err := url.Parse(base); err != nil {
		return nil, err
	}
	return &couchClient{
		baseURL:  base,
		username: config.CouchDBUsername,
		password: config.CouchDBPassword,
		client: &http.Client{
			Transport: &http.Transport{
				ResponseHeaderTimeout: 30 * time.Second,
				IdleConnTimeout:       90 * time.Second,
			},
		},
	}, nil
}

func (c *couchClient) getRecord(ctx context.Context, dbName, recordID string) (recordStub, error) {
	var stub recordStub
	err := c.doJSON(ctx, http.MethodGet, couchPath(dbName, recordID), nil, &stub)
	return stub, err
}

func (c *couchClient) revisionMetadata(ctx context.Context, dbName string, revisionIDs []string) ([]revisionMetadata, error) {
	if len(revisionIDs) == 0 {
		return nil, nil
	}
	body := map[string]any{"keys": revisionIDs, "include_docs": false}
	var response struct {
		Rows []struct {
			ID    string             `json:"id"`
			Value revisionMetadata   `json:"value"`
			Error string             `json:"error"`
		} `json:"rows"`
	}
	err := c.doJSON(ctx, http.MethodPost, couchPath(dbName, "_design", "index", "_view", "revisionMetadata"), body, &response)
	if err != nil {
		return nil, err
	}
	result := make([]revisionMetadata, 0, len(response.Rows))
	for _, row := range response.Rows {
		if row.Error != "" {
			continue
		}
		meta := row.Value
		if meta.ID == "" {
			meta.ID = row.ID
		}
		result = append(result, meta)
	}
	return result, nil
}

func (c *couchClient) getProject(ctx context.Context, projectID string) (projectDoc, error) {
	var project projectDoc
	err := c.doJSON(ctx, http.MethodGet, couchPath("projects", projectID), nil, &project)
	return project, err
}

func (c *couchClient) recordRevisionRows(ctx context.Context, dbName string, bookmark string) ([]recordRevisionRow, error) {
	values := url.Values{}
	values.Set("limit", strconv.Itoa(batchSize))
	values.Set("include_docs", "true")
	if bookmark != "" {
		encoded, _ := json.Marshal(bookmark)
		values.Set("startkey", string(encoded))
	}
	var response struct {
		Rows []recordRevisionRow `json:"rows"`
	}
	err := c.doJSON(ctx, http.MethodGet, couchPath(dbName, "_design", "index", "_view", "recordRevisions")+"?"+values.Encode(), nil, &response)
	if err != nil {
		return nil, err
	}
	if bookmark != "" && len(response.Rows) > 0 && response.Rows[0].ID == bookmark {
		response.Rows = response.Rows[1:]
	}
	return response.Rows, nil
}

func (c *couchClient) avps(ctx context.Context, dbName string, avpIDs []string) (map[string]avpDoc, error) {
	if len(avpIDs) == 0 {
		return map[string]avpDoc{}, nil
	}
	body := map[string]any{"keys": avpIDs, "include_docs": true}
	var response struct {
		Rows []struct {
			ID    string          `json:"id"`
			Doc   json.RawMessage `json:"doc"`
			Error string          `json:"error"`
		} `json:"rows"`
	}
	if err := c.doJSON(ctx, http.MethodPost, couchPath(dbName, "_all_docs"), body, &response); err != nil {
		return nil, err
	}
	result := map[string]avpDoc{}
	for _, row := range response.Rows {
		if row.Error != "" || len(row.Doc) == 0 {
			continue
		}
		var raw rawAVPDoc
		if err := decodeJSON(row.Doc, &raw); err != nil {
			return nil, err
		}
		result[row.ID] = raw.toAVP()
	}
	return result, nil
}

func (c *couchClient) getAttachment(ctx context.Context, dbName string, docID string, attachmentName string, out io.Writer) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+couchPath(dbName, docID, attachmentName), nil)
	if err != nil {
		return err
	}
	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}
	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("failed to fetch attachment %s/%s: %s", docID, attachmentName, res.Status)
	}
	_, err = io.Copy(out, res.Body)
	return err
}

func (c *couchClient) doJSON(ctx context.Context, method string, requestPath string, body any, dest any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+requestPath, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return &CouchDBError{
			StatusCode: res.StatusCode,
			Method:     method,
			Path:       requestPath,
			Body:       string(payload),
		}
	}
	if dest == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(dest)
}

func couchPath(dbName string, segments ...string) string {
	parts := []string{url.PathEscape(dbName)}
	for _, segment := range segments {
		for _, part := range strings.Split(segment, "/") {
			parts = append(parts, url.PathEscape(part))
		}
	}
	return "/" + path.Join(parts...)
}

type projectDoc struct {
	ID                    string          `json:"_id"`
	DataDB                connectionInfo  `json:"dataDb"`
	LegacyDataDB          connectionInfo  `json:"data_db"`
	UISpecification       json.RawMessage `json:"uiSpecification"`
	LegacyUISpecification json.RawMessage `json:"ui_specification"`
}

type connectionInfo struct {
	DBName string `json:"db_name"`
}

func (p projectDoc) dataDBName() string {
	if p.DataDB.DBName != "" {
		return p.DataDB.DBName
	}
	return p.LegacyDataDB.DBName
}

func (p projectDoc) uiSpec() uiSpec {
	raw := p.UISpecification
	if len(raw) == 0 {
		raw = p.LegacyUISpecification
	}
	var wrapper struct {
		UISpec uiSpec `json:"uiSpec"`
	}
	if err := decodeJSON(raw, &wrapper); err == nil && len(wrapper.UISpec.Viewsets) > 0 {
		return wrapper.UISpec
	}
	var spec uiSpec
	_ = decodeJSON(raw, &spec)
	return spec
}

type recordRevisionRow struct {
	ID    string              `json:"id"`
	Value recordRevisionValue `json:"value"`
	Doc   revisionDoc         `json:"doc"`
}

type recordRevisionValue struct {
	ID        string          `json:"_id"`
	Conflict  bool            `json:"conflict"`
	Created   json.RawMessage `json:"created"`
	CreatedBy string          `json:"created_by"`
	Type      string          `json:"type"`
}

type revisionDoc struct {
	ID           string            `json:"_id"`
	AVPs         map[string]string `json:"avps"`
	Type         string            `json:"type"`
	RecordID     string            `json:"record_id"`
	Created      string            `json:"created"`
	CreatedBy    string            `json:"created_by"`
	Deleted      bool              `json:"deleted"`
	Relationship any               `json:"relationship"`
}

type rawAVPDoc struct {
	ID               string          `json:"_id"`
	Type             string          `json:"type"`
	Data             json.RawMessage `json:"data"`
	FaimsAttachments json.RawMessage `json:"faims_attachments"`
	Annotations      annotations     `json:"annotations"`
}

type annotations struct {
	Annotation  string `json:"annotation"`
	Uncertainty bool   `json:"uncertainty"`
}

type avpDoc struct {
	ID          string
	Type        string
	Data        any
	Annotations annotations
}

func (d rawAVPDoc) toAVP() avpDoc {
	var data any
	_ = decodeJSON(d.Data, &data)
	// Attachment AVPs store file references in faims_attachments with data: null.
	// Mirror the Node exporter's includeAttachments:false hydration path.
	if d.Type == "faims-attachment::Files" && data == nil && len(d.FaimsAttachments) > 0 && string(d.FaimsAttachments) != "null" {
		_ = decodeJSON(d.FaimsAttachments, &data)
	}
	return avpDoc{ID: d.ID, Type: d.Type, Data: data, Annotations: d.Annotations}
}

func parseCouchTime(raw json.RawMessage) time.Time {
	var number json.Number
	if err := decodeJSON(raw, &number); err == nil {
		if value, err := number.Int64(); err == nil {
			if value > 1_000_000_000_000 {
				return time.UnixMilli(value).UTC()
			}
			return time.Unix(value, 0).UTC()
		}
	}
	var text string
	if err := decodeJSON(raw, &text); err == nil {
		return parseCouchTimeString(text)
	}
	return time.Time{}
}

func parseCouchTimeString(text string) time.Time {
	if text == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05.000Z"} {
		if parsed, err := time.Parse(layout, text); err == nil {
			return parsed.UTC()
		}
	}
	return time.Time{}
}

func decodeJSON(data []byte, dest any) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(dest)
}

func valueToString(value any) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	case bool:
		return strconv.FormatBool(v)
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(v), 'f', -1, 32)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		encoded, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprint(v)
		}
		return string(encoded)
	}
}

func asFloat(value any) (float64, bool) {
	switch v := value.(type) {
	case json.Number:
		f, err := v.Float64()
		return f, err == nil
	case float64:
		return v, true
	case int:
		return float64(v), true
	default:
		return 0, false
	}
}

func slugify(value string) string {
	value = strings.ToLower(value)
	var b strings.Builder
	lastWasUnderscore := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
			b.WriteRune(r)
			lastWasUnderscore = false
		case r == '_' || r == ' ' || r == '\t' || r == '\n' || r == '\r':
			if !lastWasUnderscore {
				b.WriteByte('_')
				lastWasUnderscore = true
			}
		}
	}
	return b.String()
}

func slugifyLabel(label string, maxLength int) string {
	slug := slugify(label)
	if len(slug) <= maxLength {
		return slug
	}
	prefixLength := maxLength - 1 - hashSuffixLength
	return slug[:prefixLength] + "_" + simpleHash(slug, hashSuffixLength)
}

func truncateWithHash(value string, maxLength int) string {
	if len(value) <= maxLength {
		return value
	}
	prefixLength := maxLength - 1 - hashSuffixLength
	if prefixLength < 1 {
		return simpleHash(value, maxLength)
	}
	return value[:prefixLength] + "_" + simpleHash(value, hashSuffixLength)
}

func simpleHash(value string, length int) string {
	var hash uint32 = 5381
	for _, r := range value {
		hash = ((hash << 5) + hash) ^ uint32(r)
	}
	hex := fmt.Sprintf("%08x", hash)
	if len(hex) < length {
		hex = strings.Repeat("0", length-len(hex)) + hex
	}
	return hex[:length]
}

func uniqueName(base string, extension string, existing map[string]struct{}) string {
	filename := base + "." + extension
	for i := 1; ; i++ {
		if _, ok := existing[filename]; !ok {
			existing[filename] = struct{}{}
			return filename
		}
		filename = fmt.Sprintf("%s_%d.%s", base, i, extension)
	}
}

func viewLabel(viewID string, viewset viewsetDef) string {
	if viewset.Label != "" {
		return viewset.Label
	}
	return viewID
}

func sortedViewsetIDs(spec uiSpec) []string {
	ids := make([]string, 0, len(spec.Viewsets))
	for id := range spec.Viewsets {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func ObjectAssign(target map[string]any, source map[string]any) {
	for key, value := range source {
		target[key] = value
	}
}

func cloneMap(source map[string]any) map[string]any {
	target := map[string]any{}
	ObjectAssign(target, source)
	return target
}

func roCrate(metadata fullMetadata) map[string]any {
	hasPart := make([]map[string]string, 0, len(metadata.IncludedFiles))
	for _, file := range metadata.IncludedFiles {
		hasPart = append(hasPart, map[string]string{"@id": file})
	}

	graph := []map[string]any{
		{
			"@id":        "ro-crate-metadata.json",
			"@type":      "CreativeWork",
			"conformsTo": map[string]string{"@id": "https://w3id.org/ro/crate/1.1"},
			"about":      map[string]string{"@id": "./"},
		},
		{
			"@id":             "./",
			"@type":           "Dataset",
			"name":            "Export of Project " + metadata.ProjectID,
			"datePublished":   metadata.ExportedAt,
			"author":          map[string]string{"@id": "#author"},
			"hasPart":         hasPart,
			"spatialFeatures": metadata.Totals.SpatialFeatures,
		},
		{
			"@id":   "#author",
			"@type": "Person",
			"name":  metadata.ExportedBy,
		},
	}

	for _, view := range metadata.Views {
		if view.CSVPath != "" {
			graph = append(graph, map[string]any{
				"@id":            view.CSVPath,
				"@type":          "File",
				"name":           view.Label + " (Records)",
				"description":    "Tabular data for " + view.Label,
				"encodingFormat": "text/csv",
				"recordCount":    view.RecordCount,
			})
		}
		if view.AttachmentPath != "" {
			graph = append(graph, map[string]any{
				"@id":             view.AttachmentPath,
				"@type":           "Dataset",
				"name":            view.Label + " (Attachments)",
				"description":     "Media and file attachments for " + view.Label,
				"attachmentCount": view.AttachmentCount,
			})
		}
	}

	for _, file := range metadata.IncludedFiles {
		if strings.HasPrefix(file, "spatial/") {
			encoding := "application/vnd.google-earth.kml+xml"
			name := "KML Spatial Data"
			if strings.HasSuffix(file, ".geojson") {
				encoding = "application/geo+json"
				name = "GeoJSON Spatial Data"
			}
			graph = append(graph, map[string]any{
				"@id":            file,
				"@type":          "File",
				"name":           name,
				"encodingFormat": encoding,
			})
		}
	}

	return map[string]any{
		"@context": "https://w3id.org/ro/crate/1.1/context",
		"@graph":   graph,
	}
}
