# Fieldmark Quick Start Guide for Researchers

This guide helps researchers design effective digital data collection notebooks using Fieldmark's Designer web application. We focus on practical patterns and field-tested approaches to streamline your transition from paper to digital recording.

## Quick Reference: Selecting the Right Field Type

| What You Want to Record | Field Type to Use | Example | Key Considerations |
|------------------------|-------------------|---------|-------------------|
| **Text & Identifiers** ||||
| Short names or labels | Single-line text | "North wall", "Primary deposit" | Best for brief descriptors under 100 characters |
| Detailed descriptions | Multi-line text | Context descriptions, habitat observations | Accommodates paragraphs and extended notes |
| Email contacts | Email field | "pi@university.edu" | Validates email format automatically |
| Physical addresses | Address field | Museum locations, site addresses | Provides structured address components |
| Specimen barcodes | QR/Barcode scanner | "EXC2024-001" | Mobile devices only |
| Record IDs | Templated String | "SITE1-2024-045" | Combines multiple fields automatically |
| **Numbers & Measurements** ||||
| Simple counts | Number field | Sherd count: 47 | Basic numeric entry |
| Constrained measurements | Controlled number | pH (0–14): 7.2 | Enforces minimum/maximum values |
| Sequential identifiers | Auto-incrementing | Context: 001, 002, 003... | Generates unique sequential numbers |
| **Dates & Times** ||||
| Collection dates | Date picker | 15/03/2024 | Date without time component |
| Precise timestamps | DateTime picker | 15/03/2024 14:30 | Includes both date and time |
| Quick timestamps | DateTime Now | One-tap current time | Captures current moment instantly |
| Approximate dates | Month picker | March 2024 | When day precision unnecessary |
| **Choices & Categories** ||||
| Binary decisions | Checkbox | "Sample collected?" ✓ | Simple yes/no |
| Single choice (few options) | Radio buttons | Preservation: Excellent/Good/Fair/Poor | Shows all options simultaneously |
| Single choice (many options) | Dropdown | Species from extensive list | Conserves screen space |
| Multiple selections | Multi-select | Materials present: Ceramic, Glass, Metal | Allows several choices |
| Hierarchical categories | Hierarchical dropdown | Kingdom → Phylum → Species | Nested taxonomies |
| **Location & Spatial** ||||
| Point coordinates | Take GPS point | Lat: -33.8688, Long: 151.2093 | Single coordinate capture |
| Boundaries and features | Map drawing | Polygons, lines, points | Visual feature creation on base maps |
| **Media & Files** ||||
| Field photographs | Take photo | Site images, specimen photos | Camera or gallery selection |
| Document attachments | File upload | PDFs, spreadsheets, reports | Accepts any file type |
| **Relationships** ||||
| Record connections | Related records | Links between contexts, samples to sites | Creates data relationships |
| **Instructions** ||||
| Field guidance | Rich text | "Remember to photograph before excavating" | Display-only formatted text |

## Essential Patterns for Field Research

### Creating Parent–Child Hierarchies

Most field research involves hierarchical data structures. Fieldmark enables you to establish these relationships naturally through parent–child connections.

**Archaeological Pattern:**

- Site → Trenches → Contexts → Features → Finds
- Each find belongs to a feature, each feature to a context

**Ecological Pattern:**

- Survey → Transects → Observation Points → Specimens
- Specimens link directly to their collection point

**Geological Pattern:**

- Project → Localities → Outcrops → Samples → Analyses
- Maintains complete chain of custody

When designing hierarchies, consider that deeper structures require more navigation. We recommend limiting depth to three or four levels for optimal field usability.

### Human-Readable IDs

Whilst technically optional, we strongly recommend configuring a human-readable identifier (HRID) for every form using the Templated String field type. Without an HRID, the system defaults to cryptic record IDs (e.g., "rec-5f8a9b3c"), significantly complicating data management and export interpretation. The Templated String field combines multiple field values into meaningful identifiers that make your data immediately comprehensible.

**Effective ID Patterns:**

- Archaeological: Site-Trench-Context → "MP24-T5-C023"
- Ecological: Transect-Point-Date → "T1-P5-20240315"
- Geological: Project-Outcrop-Sample → "GEO2024-OUT3-S045"

The Templated String field automatically updates as component values change, ensuring consistency across your dataset. Configure this as your form's primary identifier to maintain meaningful record lists and exports.

## Common Fieldwork Scenarios

### Scenario 1: Recording Stratigraphic Relationships

Create sophisticated relationship networks between contexts using the Related Records field. Configure vocabulary pairs like "cuts/is cut by" or "fills/is filled by" to capture bidirectional relationships. The system maintains both sides of the relationship automatically, ensuring data consistency.

### Scenario 2: Sample Collection with Photography

Design a two-level hierarchy with sampling locations as parents and individual samples as children. Include Take Photo fields at both levels – the parent captures site context whilst children document individual specimens. Enable the device download toggle in media-heavy notebooks to manage storage efficiently across team devices.

### Scenario 3: Ecological Transect Surveys

Structure your notebook with transects as parent records containing start and end GPS points. Create observation points as child records, incorporating:

- Hierarchical dropdowns for species identification
- Controlled number fields for percentage cover (0–100)
- Multi-select fields for observed behaviours
- Sticky fields for observer names and conditions that remain constant

### Scenario 4: Rapid Assessment Protocols

Optimise for speed using DateTime Now fields for instant timestamps and Radio buttons for quick categorical assessments. Configure auto-incrementing fields for sequential point numbers. Enable sticky behaviour on team member and environmental condition fields to maintain values across multiple records, significantly accelerating data entry.

## Mobile vs Desktop: Platform Considerations

### Mobile-Specific Features

Several capabilities are exclusive to iOS and Android applications:

- **QR/Barcode scanning** requires device camera access
- **GPS accuracy** generally superior on mobile devices
- **Offline functionality** more robust in dedicated apps
- **Touch optimisation** for field conditions

### Desktop Advantages

The web interface excels for:

- **Complex data entry** with keyboard efficiency
- **Relationship management** with larger screen real estate
- **Data review and editing** with comprehensive overview
- **Notebook design** using the Designer interface

### Choosing Your Platform

Consider tablets as an optimal middle ground, combining portability with sufficient screen space for complex forms. Design your notebooks acknowledging that most field data collection occurs on mobile devices whilst review and analysis happen on desktop systems.

## Conditional Logic Patterns

Fieldmark's conditional logic enables dynamic forms that adapt to your data, showing relevant fields based on previous responses.

### Pattern 1: Progressive Detail

Create a checkbox asking "Record detailed measurements?" When selected, reveal comprehensive measurement fields. This approach keeps forms uncluttered whilst allowing detailed recording when necessary.

### Pattern 2: Specification Fields

Include "Other" in dropdown menus, triggering a text field for specification when selected. This pattern accommodates unexpected values whilst maintaining controlled vocabularies.

### Pattern 3: Type-Dependent Recording

Different feature types require different information. A "Feature type" radio button can reveal:

- Burial-specific fields for human remains protocols
- Sampling fields for hearth features
- Dimensional fields for postholes
This ensures collectors see only relevant fields for their current context.

## Best Practices for Effective Notebooks

### Design Principles

1. **Follow workflow sequences** – Order fields matching natural recording patterns
2. **Group related information** – Use sections to organise logical field clusters
3. **Minimise requirements** – Mark only truly essential fields as required
4. **Provide clear guidance** – Write helpful field descriptions assuming minimal training
5. **Test thoroughly** – Validate notebooks on target devices before deployment

### Performance Optimisation

1. **Strategic field selection** – Radio buttons render faster than dropdowns for small option sets
2. **Sticky field configuration** – Maintain rarely-changing values across records
3. **Media management** – Separate photo-intensive forms from data forms where feasible
4. **Field positioning** – Place frequently-used fields at form tops
5. **Relationship design** – Consider performance implications for extensively linked data

### Data Quality Strategies

1. **Consistent naming** – Establish and document naming conventions
2. **Unit specification** – Include units in field labels: "Depth (cm)"
3. **Validation rules** – Configure appropriate constraints for numeric fields
4. **Export planning** – Design with your analysis workflow in mind
5. **Documentation** – Maintain a data dictionary alongside your notebook

## Troubleshooting Common Issues

### GPS Acquisition Problems

If GPS struggles to acquire position:

- Move to open sky away from buildings and tree cover
- Allow 30–60 seconds for satellite acquisition
- Verify device location services are enabled
- Consider using Map Field for manual position selection

### Photo Synchronisation Challenges

For notebooks with extensive photography:

- Configure image compression settings appropriately
- Enable device-specific download toggles
- Schedule synchronisation for WiFi availability
- Consider separate photo documentation forms

### Vocabulary Limitations

When controlled vocabularies prove restrictive:

- Add "Other" options with specification fields
- Consider multi-select for non-exclusive categories
- Document new terms for vocabulary updates
- Use hierarchical dropdowns for complex taxonomies

### Data Entry Errors

To minimise recording mistakes:

- Verify all required fields display clear indicators
- Check validation messages are helpful, not cryptic
- Test numeric constraints match expected ranges
- Ensure date formats align with user expectations
- Configure appropriate default values

### Synchronisation Issues

When data won't sync:

- Confirm network connectivity
- Check available device storage
- Verify user authentication
- Review any validation errors
- Consider data volume and connection speed

## Where to Get More Help

- **Field Type Reference**: Comprehensive documentation for all field types and configurations
- **Designer Documentation**: Detailed guidance on using the notebook Designer interface
- **Template Library**: Example notebooks for various research disciplines
- **Community Resources**: Forums for sharing patterns and troubleshooting with other researchers
- **Technical Support**: Contact details for system-specific assistance

Remember that successful digital field recording emerges from iterative refinement. Start with simple notebooks, gather user feedback, and progressively enhance your designs based on real-world experience.

---

*This guide reflects current Fieldmark capabilities. Features and interfaces may evolve with system updates.*