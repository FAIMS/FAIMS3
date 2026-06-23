package exporter

import (
	"encoding/json"
	"testing"
)

func TestRawAVPDocToAVPUsesFaimsAttachments(t *testing.T) {
	raw := rawAVPDoc{
		ID:   "avp-test",
		Type: "faims-attachment::Files",
		Data: json.RawMessage(`null`),
		FaimsAttachments: json.RawMessage(`[
			{"attachment_id":"att-123","filename":"photo.png","file_type":"image/png"}
		]`),
		Annotations: annotations{Annotation: "field note", Uncertainty: true},
	}

	avp := raw.toAVP()
	if avp.Type != "faims-attachment::Files" {
		t.Fatalf("expected attachment type, got %q", avp.Type)
	}

	items, ok := avp.Data.([]any)
	if !ok {
		t.Fatalf("expected []any data, got %T", avp.Data)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 attachment ref, got %d", len(items))
	}

	refs := parseAttachmentRefs(avp.Data)
	if len(refs) != 1 || refs[0].AttachmentID != "att-123" {
		t.Fatalf("unexpected attachment refs: %#v", refs)
	}
	if avp.Annotations.Annotation != "field note" || !avp.Annotations.Uncertainty {
		t.Fatalf("unexpected annotations: %#v", avp.Annotations)
	}
}

func TestRawAVPDocToAVPPrefersDataWhenPresent(t *testing.T) {
	raw := rawAVPDoc{
		ID:   "avp-test",
		Type: "faims-attachment::Files",
		Data: json.RawMessage(`[
			{"attachment_id":"att-from-data","filename":"a.jpg","file_type":"image/jpeg"}
		]`),
		FaimsAttachments: json.RawMessage(`[
			{"attachment_id":"att-from-faims","filename":"b.jpg","file_type":"image/jpeg"}
		]`),
	}

	avp := raw.toAVP()
	refs := parseAttachmentRefs(avp.Data)
	if len(refs) != 1 || refs[0].AttachmentID != "att-from-data" {
		t.Fatalf("expected data field to win, got %#v", refs)
	}
}

func TestRawAVPDocToAVPDecodesStoredAnnotations(t *testing.T) {
	var raw rawAVPDoc
	if err := decodeJSON([]byte(`{
		"_id":"avp-test",
		"type":"faims-attachment::Files",
		"data":null,
		"annotations":{"annotation":"note","uncertainty":false}
	}`), &raw); err != nil {
		t.Fatalf("decode failed: %v", err)
	}

	avp := raw.toAVP()
	if avp.Annotations.Annotation != "note" || avp.Annotations.Uncertainty {
		t.Fatalf("unexpected annotations: %#v", avp.Annotations)
	}
}

func TestParseAttachmentRefsIgnoresNull(t *testing.T) {
	if refs := parseAttachmentRefs(nil); refs != nil {
		t.Fatalf("expected nil refs for null data, got %#v", refs)
	}
}
