package exporter

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"google.golang.org/grpc/codes"
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

func TestEscapeCSVFormula(t *testing.T) {
	cases := map[string]string{
		"=1+1":    "'=1+1",
		"+123":    "'+123",
		"-value":  "'-value",
		"@sum":    "'@sum",
		"\tcell":  "'\tcell",
		"normal":  "normal",
		"":        "",
	}
	for input, want := range cases {
		if got := csvCell(input); got != want {
			t.Fatalf("csvCell(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestSlugifyFilenameCollisionSuffixes(t *testing.T) {
	existing := map[string]struct{}{}
	first := attachmentFilename("view", "field", "hrid", "image/png", existing)
	second := attachmentFilename("view", "field", "hrid", "image/png", existing)
	if first == second {
		t.Fatalf("expected collision suffix, got duplicate %q", first)
	}
	if existing[first] == struct{}{} && existing[second] == struct{}{} {
		// both tracked
	}
}

func TestFilterDeletedRelatedRefs(t *testing.T) {
	spec := uiSpec{
		Fields: map[string]fieldDef{
			"relF": {
				ComponentNamespace:  "faims-custom",
				ComponentName:       "RelatedRecordSelector",
				ComponentParameters: json.RawMessage(`{"multiple":true}`),
			},
		},
	}
	fields := []fieldSummary{{
		Name:               "relF",
		ComponentNamespace: "faims-custom",
		ComponentName:      "RelatedRecordSelector",
	}}
	data := map[string]any{
		"relF": []any{
			map[string]any{"record_id": "live", "relation_type_vocabPair": []any{"is related to", "is related to"}},
			map[string]any{"record_id": "deleted", "relation_type_vocabPair": []any{"is related to", "is related to"}},
		},
	}
	filterDeletedRelatedRefs(spec, fields, data, map[string]bool{
		"live":    true,
		"deleted": false,
	})

	items, ok := data["relF"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("expected one kept relationship, got %#v", data["relF"])
	}
	first, _ := items[0].(map[string]any)
	if first["record_id"] != "live" {
		t.Fatalf("expected live record only, got %#v", first)
	}
}

func TestAppendAttachmentsFieldTypes(t *testing.T) {
	spec := uiSpec{
		Fields: map[string]fieldDef{
			"photo": {
				ComponentNamespace: "faims-custom",
				ComponentName:      "TakePhoto",
				TypeReturned:       "faims-core::Json",
			},
			"upload": {
				ComponentNamespace: "faims-custom",
				ComponentName:      "FileUploader",
			},
			"files": {
				TypeReturned: "faims-attachment::Files",
			},
			"text": {
				ComponentNamespace: "faims-core",
				ComponentName:      "StringField",
			},
		},
	}
	if !isAttachmentField(spec, "photo", "faims-core::Json") {
		t.Fatal("TakePhoto should be treated as attachment field")
	}
	if !isAttachmentField(spec, "upload", "") {
		t.Fatal("FileUploader should be treated as attachment field")
	}
	if !isAttachmentField(spec, "files", "faims-attachment::Files") {
		t.Fatal("faims-attachment::Files should be treated as attachment field")
	}
	if isAttachmentField(spec, "text", "faims-core::String") {
		t.Fatal("non-attachment field should be rejected")
	}
}

func TestSpatialEmptyGeoJSON(t *testing.T) {
	e := &Exporter{}
	ec := &exportContext{UISpec: uiSpec{Viewsets: map[string]viewsetDef{}}}
	var buf stringsBuilder
	if err := e.writeGeoJSON(contextWithCancel(t), ec, &buf); err != nil {
		t.Fatalf("writeGeoJSON failed: %v", err)
	}
	want := `{"type":"FeatureCollection","features":[]}`
	if buf.String() != want {
		t.Fatalf("got %q, want %q", buf.String(), want)
	}
}

func TestSpatialEmptyKML(t *testing.T) {
	e := &Exporter{}
	ec := &exportContext{UISpec: uiSpec{Viewsets: map[string]viewsetDef{}}}
	var buf stringsBuilder
	if err := e.writeKML(contextWithCancel(t), ec, &buf); err != nil {
		t.Fatalf("writeKML failed: %v", err)
	}
	if !strings.Contains(buf.String(), `<?xml version="1.0"`) || !strings.Contains(buf.String(), `<Document></Document>`) {
		t.Fatalf("unexpected empty KML payload: %q", buf.String())
	}
}

type stringsBuilder struct {
	b []byte
}

func (s *stringsBuilder) Write(p []byte) (int, error) {
	s.b = append(s.b, p...)
	return len(p), nil
}

func (s *stringsBuilder) String() string {
	return string(s.b)
}

func contextWithCancel(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	return ctx
}

func TestMapToGRPCCode(t *testing.T) {
	if mapToGRPCCode(invalidArgumentf("bad")) != codes.InvalidArgument {
		t.Fatal("expected InvalidArgument")
	}
	if mapToGRPCCode(notFoundf("missing")) != codes.NotFound {
		t.Fatal("expected NotFound")
	}
	if mapToGRPCCode(&CouchDBError{StatusCode: 403}) != codes.PermissionDenied {
		t.Fatal("expected PermissionDenied")
	}
}