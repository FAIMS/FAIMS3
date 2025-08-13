# Field Selection Best Practices Guide

## Introduction: Principled Field Selection for Digital Recording

The transition from paper-based to digital field recording necessitates fundamental reconsideration of data structure and capture mechanisms. This guide articulates evidence-based principles for field selection within {{FAIMS}}, drawing upon extensive deployment experience across archaeological, ecological, and geoscientific contexts. We present both theoretical foundations and practical recommendations to support informed decision-making throughout the {{notebook}} design process.

The selection of appropriate field types represents a critical juncture where research objectives, data quality requirements, and practical constraints converge. Poor field choices cascade through the entire research lifecycle – complicating data entry, compromising analytical potential, and ultimately undermining research outcomes. Conversely, thoughtful field selection enhances both immediate usability and long-term research value.

## Core Principles for Field Selection

### Principle 1: Prefer Structure Over Free Text

Structured data supports computational analysis, enables meaningful aggregation, and facilitates data integration across projects and time. We advocate for controlled vocabularies, numeric constraints, and standardised formats wherever feasible.

**Implementation Strategy:**

- Deploy controlled vocabularies (Select, RadioGroup) for any attribute with finite, known values
- Reserve free text for genuinely unpredictable content (interpretations, unique observations)
- Utilise annotation fields to capture edge cases within structured frameworks
- Document vocabulary evolution to support longitudinal data integration

**Common Anti-patterns to Avoid:**

- Using text fields for dates, numbers, or categorical data
- Creating "Other (specify)" as primary data entry rather than exception handling
- Neglecting to review and refine vocabularies based on actual usage patterns

### Principle 2: Automate System-Knowable Information

Any information the system can determine should never require manual entry. This principle reduces errors, accelerates recording, and ensures consistency across datasets.

**System Variables Available:**

- `{{_CREATED_BY}}` – Current user (eliminates "Recorded by" fields)
- `{{_CREATED_TIME}}` – Timestamp of record creation
- Current GPS location via Take GPS Point
- Sequential identifiers through Auto-incrementing fields
- Parent record context through inheritance

**Implementation Patterns:**

Replace manual entry fields with automated capture:

- ❌ Text field for "Recorder name" → ✓ System variable in HRID
- ❌ DateTime field for "Entry time" → ✓ `{{_CREATED_TIME}}` in template
- ❌ Manual context copying → ✓ Parent-child relationships with inheritance

### Principle 3: Design for Progressive Disclosure

Complex recording scenarios benefit from conditional logic that reveals detail progressively based on initial assessments. This approach maintains form simplicity whilst enabling comprehensive documentation when necessary.

**Effective Patterns:**

1. **Binary Gateway**: Checkbox controlling detailed field visibility
2. **Type-Specific Recording**: Radio button selection revealing relevant field sets
3. **Confidence Cascades**: Uncertainty triggering additional documentation requirements
4. **Other Specification**: Controlled vocabulary with conditional free text for exceptions

**Design Considerations:**

- Initial fields should support rapid assessment
- Detailed fields appear only when relevant
- Conditional logic should follow intuitive workflows
- Avoid deeply nested conditions that confuse users

### Principle 4: Optimise for Device Constraints

Field selection must acknowledge the realities of mobile data collection – small screens, touch interfaces, variable connectivity, and environmental challenges.

**Mobile-Optimised Selections:**

- Radio buttons over dropdowns for ≤7 options (larger touch targets)
- Checkbox for binary decisions (clear visual state)
- DateTime Now for timestamp capture (single tap)
- Take Photo over File Upload (integrated camera workflow)

**Desktop-Optimised Selections:**

- Multi-line text for extended narrative
- Hierarchical dropdowns for complex taxonomies
- Map drawing for precise spatial data
- File upload for diverse media types

### Principle 5: Maintain Human-Readable Identifiers

Whilst technically optional, human-readable identifiers (HRIDs) prove essential for practical data management. Without HRIDs, users confront opaque system identifiers (e.g., "rec-5f8a9b3c") that impede navigation, complicate analysis, and frustrate collaboration.

**HRID Design Patterns:**

- Combine 2–4 meaningful components
- Include type indicators for clarity
- Incorporate sequential elements for uniqueness
- Maintain consistent patterns across related forms

**Exemplar Patterns:**

- Archaeological: `{{site}}-{{trench}}-{{type}}-{{number}}`
- Ecological: `{{transect}}-{{point}}-{{date}}`
- Geological: `{{project}}-{{location}}-{{sample}}`

## Field Type Selection Decision Framework

### Textual Data Capture

We present a hierarchical decision process for text field selection:

1. **Can the value be generated automatically?**
   - YES → Use Templated String field
   - NO → Continue to question 2

2. **Does a controlled vocabulary exist or could one be developed?**
   - YES → Use Select/RadioGroup/MultiSelect as appropriate
   - NO → Continue to question 3

3. **Is the text predictably brief (<100 characters)?**
   - YES → Use Single-line text
   - NO → Use Multi-line text

4. **Does the field require specific validation?**
   - Email format → Email field
   - Physical address → Address field
   - Barcode scanning → QR/Barcode scanner (mobile only)

### Numeric Data Capture

Selection depends upon precision requirements and constraints:

1. **Are there known valid ranges?**
   - YES → Controlled Number field with min/max
   - NO → Continue to question 2

2. **Is this a sequential identifier?**
   - YES → Auto-incrementing field
   - NO → Basic Number field

3. **Consider additional factors:**
   - Decimal precision requirements
   - Default values to accelerate entry
   - Sticky behaviour for environmental constants
   - Unit specification in field labels

### Temporal Data Capture

Temporal granularity determines field selection:

- **Date only** → Date Picker (excavation date, sample date)
- **Date and time** → DateTime Picker (precise events)
- **Current moment** → DateTime Now (observation timestamp)
- **Month/year only** → Month Picker (seasonal data)

### Choice Field Selection

The number of options and selection constraints guide choice:

**Single Selection:**

- 2 options → Checkbox (if binary) or RadioGroup (if strings needed)
- 3–7 options → RadioGroup (all visible)
- 8–20 options → Select dropdown
- >20 options OR hierarchical → AdvancedSelect

**Multiple Selection:**

- Always use MultiSelect
- Enable expandedChecklist for <10 options
- Configure exclusiveOptions for mutually incompatible choices

### Spatial Data Capture

Spatial requirements determine appropriate fields:

- **Single point** → Take GPS Point
- **Boundaries/areas** → Map Field (requires internet)
- **Both needed** → Combine both field types
- **Manual coordinates** → Text field with validation

## Common Implementation Patterns

### The Measurement Pattern

Combine multiple fields for comprehensive measurement documentation:

1. Measurement type (RadioGroup/Select)
2. Numeric value (Controlled Number with range)
3. Units (incorporated in label or separate Select)
4. Uncertainty/precision (annotation or dedicated field)

### The Identification Pattern

Support confident and provisional identifications:

1. Quick identification (Select from common options)
2. Confidence level (RadioGroup: Certain/Probable/Possible)
3. Requires verification (Checkbox, conditional on confidence)
4. Detailed notes (Multi-line text, conditional on uncertainty)

### The Observation Pattern

Structure complex observations efficiently:

1. Observation type (RadioGroup for workflow branching)
2. Type-specific fields (conditional field groups)
3. Standard metadata (automatic via templates)
4. Media documentation (Take Photo with annotation)

## Vocabulary Development and Management

### Initial Development Process

1. **Literature Review**: Compile disciplinary standard terms
2. **Stakeholder Consultation**: Include local terminology
3. **Hierarchical Organisation**: Structure related terms appropriately
4. **Comprehensiveness vs Usability**: Balance completeness with efficiency

### Iterative Refinement Cycle

1. **Deploy Comprehensive Initial Vocabulary**
2. **Monitor Usage** (after 100+ records)
3. **Identify Rarely-Used Terms** (<5% selection rate)
4. **Relocate to "Other"** with annotation capability
5. **Document Changes** for data integration

### Vocabulary Versioning Strategy

- Maintain vocabulary change logs
- Preserve mappings between versions
- Plan for post-collection harmonisation
- Consider vocabulary expansion vs refinement

## Performance and Scalability Considerations

### Relationship Field Limits

The system exhibits performance degradation with extensive relationships:

- <50 relationships: Optimal performance
- 50–100 relationships: Noticeable lag
- 100–200 relationships: Significant delays
- >200 relationships: Effectively unusable

**Mitigation Strategies:**

- Distribute relationships across multiple fields
- Consider flatter data structures
- Implement type-specific relationship fields
- Plan for external relationship management if needed

### Form Complexity Thresholds

- Keep forms under 30 fields for mobile usability
- Limit sections to 10 fields for cognitive load
- Use conditional logic to reduce visible field count
- Consider splitting complex forms into multiple linked forms

### Media Field Considerations

- Configure compression settings appropriately
- Enable device-specific download toggles
- Separate media-intensive forms from data forms
- Plan server storage for complete datasets

## Quality Assurance Through Field Design

### Validation Strategy

Implement validation at appropriate levels:

- **Field level**: Format, range, pattern matching
- **Section level**: Completeness checks
- **Form level**: Cross-field consistency (limited)
- **Workflow level**: Parent-child relationships

### Error Prevention Patterns

- Use controlled inputs over free text
- Provide clear helper text and examples
- Set appropriate default values
- Enable sticky fields for constants
- Mark only essential fields as required

### Data Integrity Measures

- Configure HRIDs for every form
- Establish clear parent-child hierarchies
- Document vocabulary semantics
- Plan for orphan management
- Design for export requirements

## Platform-Specific Adaptations

### Mobile-First Fields

When mobile devices predominate:

- Prefer touch-optimised inputs
- Minimise text entry requirements
- Leverage device sensors (GPS, camera)
- Design for offline resilience
- Account for screen size constraints

### Desktop-Enhanced Fields

When desktop entry is available:

- Enable complex text composition
- Support precise spatial drawing
- Facilitate bulk operations
- Leverage keyboard efficiency
- Utilise screen real estate

### Platform Parity Strategies

For mixed-device deployments:

- Identify platform-exclusive features
- Provide alternative workflows
- Document platform requirements
- Train users on platform differences
- Plan for data integration

## Conclusion: Field Selection as Research Design

The selection of field types transcends mere technical implementation – it embodies methodological decisions about data structure, analytical possibilities, and research outcomes. Through principled field selection, we transform the contingencies of fieldwork into structured datasets that support both immediate research needs and long-term analytical potential.

This guide provides a framework for navigating the complex decision space of field selection. By understanding the capabilities and constraints of each field type, considering device realities, and maintaining focus on research objectives, {{notebook}} designers can create recording systems that enhance rather than constrain field research.

The iterative refinement of field selections, informed by actual usage patterns and emerging research questions, ensures that digital recording systems evolve alongside research programmes. Through careful attention to these principles and patterns, we enable the creation of robust, usable, and analytically powerful field recording systems.
