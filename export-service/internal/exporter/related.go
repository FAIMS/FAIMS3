package exporter

import (
	"context"
	"encoding/json"
)

const relationshipComponent = "faims-custom::RelatedRecordSelector"

type recordStub struct {
	ID    string   `json:"_id"`
	Heads []string `json:"heads"`
}

type revisionMetadata struct {
	ID      string `json:"_id"`
	Deleted bool   `json:"deleted"`
}

type relatedRecordEntry struct {
	RecordID              string `json:"record_id"`
	RelationTypeVocabPair []any  `json:"relation_type_vocabPair"`
}

func (e *Exporter) stripDeletedRelatedRefs(ctx context.Context, ec *exportContext, viewsetID string, data map[string]any) error {
	fields, err := fieldsForViewset(ec.UISpec, viewsetID)
	if err != nil || len(fields) == 0 {
		return err
	}

	relatedIDs := map[string]struct{}{}
	relationshipFields := []fieldSummary{}

	for _, field := range fields {
		if componentKey(field.ComponentNamespace, field.ComponentName) != relationshipComponent {
			continue
		}
		raw, ok := data[field.Name]
		if !ok || raw == nil {
			continue
		}
		entries, ok := parseRelatedRecordEntries(raw)
		if !ok {
			continue
		}
		relationshipFields = append(relationshipFields, field)
		for _, entry := range entries {
			if entry.RecordID != "" {
				relatedIDs[entry.RecordID] = struct{}{}
			}
		}
	}

	if len(relatedIDs) == 0 {
		return nil
	}

	keepByRecordID, err := e.shouldKeepRelatedRecordLinks(ctx, ec.DataDB, relatedIDs)
	if err != nil {
		return err
	}

	for _, field := range relationshipFields {
		raw := data[field.Name]
		entries, ok := parseRelatedRecordEntries(raw)
		if !ok {
			continue
		}
		multiple := relatedFieldMultiple(ec.UISpec, field.Name)
		kept := make([]relatedRecordEntry, 0, len(entries))
		for _, entry := range entries {
			if keepByRecordID[entry.RecordID] {
				kept = append(kept, entry)
			}
		}
		if multiple {
			if len(kept) == 0 {
				data[field.Name] = []any{}
			} else {
				out := make([]any, 0, len(kept))
				for _, entry := range kept {
					out = append(out, map[string]any{
						"record_id":                entry.RecordID,
						"relation_type_vocabPair": entry.RelationTypeVocabPair,
					})
				}
				data[field.Name] = out
			}
		} else if len(kept) == 0 {
			data[field.Name] = ""
		} else {
			data[field.Name] = map[string]any{
				"record_id":                kept[0].RecordID,
				"relation_type_vocabPair": kept[0].RelationTypeVocabPair,
			}
		}
	}

	return nil
}

func parseRelatedRecordEntries(raw any) ([]relatedRecordEntry, bool) {
	switch value := raw.(type) {
	case []any:
		entries := make([]relatedRecordEntry, 0, len(value))
		for _, item := range value {
			entry, ok := parseRelatedRecordEntry(item)
			if !ok {
				continue
			}
			entries = append(entries, entry)
		}
		return entries, true
	case map[string]any:
		entry, ok := parseRelatedRecordEntry(value)
		if !ok {
			return nil, false
		}
		return []relatedRecordEntry{entry}, true
	default:
		return nil, false
	}
}

func parseRelatedRecordEntry(raw any) (relatedRecordEntry, bool) {
	obj, ok := raw.(map[string]any)
	if !ok {
		return relatedRecordEntry{}, false
	}
	recordID := valueToString(obj["record_id"])
	if recordID == "" {
		return relatedRecordEntry{}, false
	}
	var pair []any
	if rawPair, ok := obj["relation_type_vocabPair"]; ok {
		if typed, ok := rawPair.([]any); ok {
			pair = typed
		}
	}
	return relatedRecordEntry{RecordID: recordID, RelationTypeVocabPair: pair}, true
}

func relatedFieldMultiple(spec uiSpec, fieldName string) bool {
	field, ok := spec.Fields[fieldName]
	if !ok || len(field.ComponentParameters) == 0 {
		return false
	}
	var params struct {
		Multiple bool `json:"multiple"`
	}
	if err := decodeJSON(field.ComponentParameters, &params); err != nil {
		return false
	}
	return params.Multiple
}

func (e *Exporter) shouldKeepRelatedRecordLinks(ctx context.Context, dbName string, relatedIDs map[string]struct{}) (map[string]bool, error) {
	keep := map[string]bool{}
	headByRecord := map[string]string{}

	for recordID := range relatedIDs {
		stub, err := e.couch.getRecord(ctx, dbName, recordID)
		if err != nil {
			keep[recordID] = false
			continue
		}
		headID, err := resolveHead(recordID, stub.Heads)
		if err != nil {
			keep[recordID] = false
			continue
		}
		headByRecord[recordID] = headID
	}

	headIDs := make([]string, 0, len(headByRecord))
	seen := map[string]struct{}{}
	for _, headID := range headByRecord {
		if _, ok := seen[headID]; ok {
			continue
		}
		seen[headID] = struct{}{}
		headIDs = append(headIDs, headID)
	}
	if len(headIDs) == 0 {
		return keep, nil
	}

	metadata, err := e.couch.revisionMetadata(ctx, dbName, headIDs)
	if err != nil {
		return nil, err
	}
	deletedByHeadID := map[string]bool{}
	for _, item := range metadata {
		deletedByHeadID[item.ID] = item.Deleted
	}

	for recordID, headID := range headByRecord {
		deleted, ok := deletedByHeadID[headID]
		if !ok {
			keep[recordID] = false
		} else {
			keep[recordID] = !deleted
		}
	}

	return keep, nil
}

func resolveHead(recordID string, heads []string) (string, error) {
	if len(heads) == 0 {
		return "", notFoundf("record %s has no heads", recordID)
	}
	return heads[len(heads)-1], nil
}

// filterDeletedRelatedRefs is exported for unit tests with injected Couch responses.
func filterDeletedRelatedRefs(
	spec uiSpec,
	fields []fieldSummary,
	data map[string]any,
	keepByRecordID map[string]bool,
) {
	relationshipFields := []fieldSummary{}
	for _, field := range fields {
		if componentKey(field.ComponentNamespace, field.ComponentName) != relationshipComponent {
			continue
		}
		if _, ok := data[field.Name]; ok {
			relationshipFields = append(relationshipFields, field)
		}
	}

	for _, field := range relationshipFields {
		raw := data[field.Name]
		entries, ok := parseRelatedRecordEntries(raw)
		if !ok {
			continue
		}
		multiple := relatedFieldMultiple(spec, field.Name)
		kept := make([]relatedRecordEntry, 0, len(entries))
		for _, entry := range entries {
			if keepByRecordID[entry.RecordID] {
				kept = append(kept, entry)
			}
		}
		if multiple {
			out := make([]any, 0, len(kept))
			for _, entry := range kept {
				out = append(out, map[string]any{
					"record_id":                entry.RecordID,
					"relation_type_vocabPair": entry.RelationTypeVocabPair,
				})
			}
			data[field.Name] = out
		} else if len(kept) == 0 {
			data[field.Name] = ""
		} else {
			data[field.Name] = map[string]any{
				"record_id":                kept[0].RecordID,
				"relation_type_vocabPair": kept[0].RelationTypeVocabPair,
			}
		}
	}
}

// decodeComponentParameters is used in tests.
func decodeComponentParameters(raw json.RawMessage) bool {
	var params struct {
		Multiple bool `json:"multiple"`
	}
	if err := decodeJSON(raw, &params); err != nil {
		return false
	}
	return params.Multiple
}
