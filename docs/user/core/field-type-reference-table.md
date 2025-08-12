# Fieldmark Field Type Summary Reference Table

This comprehensive reference provides detailed specifications for all Fieldmark field types, supporting informed selection for digital data collection notebook design. We present technical capabilities, validation options, and platform-specific considerations for each field type within the Designer interface.

## Text and Identifier Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Single-line Text** | Brief textual entries where neither controlled vocabularies nor auto-generation are appropriate | "North wall", "Sandy matrix", "Excavator notes" | Character limit: ~255 practical maximum<br/>Input types: text, email, url<br/>Returns: String | Pattern matching via regex<br/>Length constraints<br/>Required field option | Universal compatibility<br/>Predictive text on mobile |
| **Multi-line Text** | Extended descriptive content requiring paragraph formatting | Context descriptions, interpretation notes, detailed observations | No practical character limit<br/>Adjustable row height<br/>Returns: String | Length validation<br/>Required field option<br/>No pattern matching | Touch keyboard challenges on mobile<br/>Consider voice-to-text |
| **Email** | Validated email address collection | "projectlead@university.edu", "lab@institution.org" | Standard email validation<br/>Returns: String | RFC 5322 compliant validation<br/>Required field option | Keyboard switches to email mode on mobile |
| **Address** | Structured physical address components | Site locations, institutional addresses, property details | Multiple sub-fields (street, city, state, postcode)<br/>Returns: Structured object | Component-level validation<br/>Postcode format checking | Auto-complete varies by platform |
| **Templated String** | Auto-generated identifiers combining multiple field values | "SITE1-2024-CTX045", "{{project}}-{{date}}-{{counter}}" | Mustache.js templating<br/>Supports conditionals<br/>Returns: String<br/>Read-only display | Not user-editable<br/>Updates dynamically | Essential for human-readable IDs<br/>No parent field access |
| **QR/Barcode Scanner** | Camera-based code capture for pre-printed labels | Specimen barcodes, equipment tags, location markers | Supports multiple formats (QR, Code128, etc.)<br/>Returns: String | Format validation possible<br/>Pattern matching | **Mobile applications only**<br/>Not available on web |

## Numeric Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Number Field** | Basic numeric entry without constraints | Artefact counts, simple measurements | Integer or decimal<br/>JavaScript number type<br/>Returns: Number | Type checking only<br/>No range validation | Period (.) required for decimals<br/>No locale formatting |
| **Controlled Number** | Numeric values with enforced boundaries | pH (0–14), percentage (0–100), depth (0–500cm) | Min/max enforcement<br/>Step increments<br/>Default values<br/>Returns: Number | Range validation<br/>Precision control<br/>Required field option | Supports sticky behaviour<br/>Spinner controls optional |
| **Auto-incrementing** | Sequential identifier generation | Context numbers (001, 002...), Sample IDs | Configurable padding<br/>Starting value<br/>Returns: String | Uniqueness guaranteed<br/>No user override | Cannot reset mid-project<br/>Team coordination critical |

## Date and Time Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Date Picker** | Calendar date selection without time | Excavation date, sample collection date | ISO 8601 format<br/>Returns: Date string | Min/max date ranges<br/>Required field option | Native date pickers on mobile<br/>Calendar widget on desktop |
| **DateTime Picker** | Combined date and time selection | Precise event timing, scheduled observations | ISO 8601 with time<br/>Returns: DateTime string | Date and time ranges<br/>Required field option | Platform-specific interfaces |
| **DateTime Now** | One-tap current timestamp capture | Record creation time, observation moment | Automatic capture<br/>User-triggered<br/>Returns: DateTime string | Always valid<br/>Can be required | Device clock dependency<br/>Timezone considerations |
| **Month Picker** | Year and month selection only | Seasonal data, approximate dates | YYYY-MM format<br/>Returns: String | Year range limits<br/>Required field option | Simplified interface<br/>No day selection |

## Selection Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Checkbox** | Binary true/false decisions | "Sample collected?", "Photography complete?" | Returns: Boolean<br/>Default: false | Required completion<br/>Can control logic | Large touch target on mobile |
| **Radio Buttons** | Single selection from 2–7 visible options | Preservation state, weather conditions | All options visible<br/>Returns: String value | Required selection<br/>Option validation | Excellent mobile usability<br/>Space consuming |
| **Dropdown (Select)** | Single selection from many options | Species list (50+ items), material types | Conserves screen space<br/>Returns: String value | Required selection<br/>Dependent on vocabulary | Scrolling challenges on mobile |
| **Multi-select** | Multiple simultaneous selections | Construction materials, observed behaviours | Checkbox list<br/>Returns: Array of strings | Min/max selections<br/>Required field option | Touch selection challenging<br/>Consider chip display |
| **Hierarchical Dropdown** | Nested categorical selection | Taxonomies, period → phase → subphase | Tree navigation<br/>Returns: Full path or leaf | Depth validation<br/>Required at any level | Complex navigation on mobile<br/>Consider search function |

## Spatial Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Take GPS Point** | Single coordinate capture | Find spots, sample locations, photo positions | Returns: GeoJSON point<br/>Includes metadata (accuracy, altitude) | Accuracy thresholds<br/>Required field option | Mobile GPS superior<br/>Browser geolocation limited |
| **Map Drawing** | Visual feature creation on base maps | Site boundaries, excavation areas, transects | Points, lines, polygons<br/>Returns: GeoJSON<br/>Multiple features | Geometry validation<br/>Area/length constraints | **Requires internet for base maps**<br/>Touch precision varies |

## Media Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Take Photo** | Camera capture or gallery selection | Context photos, artefact images, working shots | JPEG/PNG<br/>EXIF preserved<br/>Returns: File reference | File size limits<br/>Required field option | Compression settings<br/>Storage considerations |
| **File Upload** | Arbitrary file attachment | PDFs, spreadsheets, audio, video | Any file type<br/>No size limits (practical)<br/>Returns: File reference | Type restrictions possible<br/>Required field option | Upload time considerations<br/>Bandwidth dependent |

## Relationship Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Related Records** | Inter-record connections | Stratigraphic relationships, sample → context links | Parent-child or peer<br/>Vocabulary pairs<br/>Returns: Relationship array | Required relationships<br/>Cardinality limits | Performance degrades >50 relationships<br/>Mobile interface limited |

## Display Fields

| Field Type | Purpose & Description | Typical Examples | Technical Specifications | Validation Capabilities | Platform Considerations |
|------------|----------------------|------------------|------------------------|------------------------|------------------------|
| **Rich Text** | Formatted instructional content | Warnings, procedures, contextual help | Markdown support<br/>Display only<br/>No data storage | Not applicable | Responsive rendering<br/>Image embedding supported |

## Critical Implementation Considerations

### Human-Readable Identifiers (HRIDs)
Whilst technically optional, we strongly recommend implementing HRIDs using Templated String fields for every form. Without HRIDs, the system defaults to opaque UUIDs (e.g., "rec-5f8a9b3c"), substantially complicating data management, export interpretation, and team communication. Configure the `hridField` property in your viewset to specify which Templated String field serves as the identifier.

### Conditional Logic Architecture
Fields capable of controlling logic (marked in specifications) can trigger visibility conditions through standardised operators (equal, not-equal, greater-than, less-than). Complex conditions utilise AND/OR combinations. Note that controller fields require the `logic_select` property or inclusion in `conditional_sources` for optimal performance.

### Platform-Specific Limitations
Critical platform disparities require careful consideration:
- QR/Barcode scanning functions exclusively on mobile applications
- Map fields require internet connectivity for initial tile loading
- GPS accuracy varies significantly between mobile devices and browsers
- Touch interfaces present challenges for precise selection and text entry

### Performance Boundaries
Documented performance thresholds inform design decisions:
- Relationship fields: Noticeable degradation beyond 50 relationships, unusable beyond 200
- Long option lists: Consider hierarchical organisation beyond 20 items
- Media synchronisation: Device-specific download toggles essential for photo-intensive notebooks
- Complex conditional logic: Multiple controller fields may impact form responsiveness

### Validation Limitations
Current validation architecture exhibits specific constraints:
- No cross-field validation (cannot compare Field A to Field B)
- No custom validation functions for project-specific rules
- No mathematical operations between fields
- No prevention of logical contradictions in relationships
- Validation occurs client-side with limited server verification

### Export Considerations
Each entity type exports as a separate CSV file with relationships preserved through identifier columns. The export format maintains relationship semantics (e.g., "cuts/CTX-042;fills/CTX-043") but requires manual reconstruction for hierarchical analysis. Design vocabularies and identifiers with post-processing requirements in mind.

---

*This reference table reflects Fieldmark capabilities as documented in 2024–2025. Platform updates may introduce new features or modify existing behaviour. Consult current documentation for production deployments.*