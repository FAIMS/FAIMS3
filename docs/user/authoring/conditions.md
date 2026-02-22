# Conditions on Sections and Fields

A form can include conditional display of both _sections_ and _fields_ using a rich
conditional structure.  Conditions are created and edited using the _condition editor_.

```{screenshot} designer/section-condition.png
:alt: Editing the condition on a section of the form
:width: 100%
```

A condition on a _section_ or _field_ determines whether they will be shown
in the form.  Conditions are based on the values of one or more fields and
are evaluated each time a value changes in the form.  This means that when
the user enters data in the form, some fields or sections may appear or
disappear.

## Simple Conditions

A simple condition compares the value of a field with the value entered in
the condition. There are three parts to a simple condition: _Field_, _Operator_
and _Value_.  

The _Field_ is the target field who's value will be compared.  In
the condition editor you will see a drop-down list of all of the fields in
the {{notebook}}.  For a condition on a field, you won't see the field itself.

For the _Value_ you can generally enter a target value or select from a drop-down
list of possible values.

The _Operator_ is used to compare the field value and the condition value.  The
operators available depend on the type of the field. 

For select and checkbox
values you will see _equal_ and _not equal_ which compare the field value to
one of the possible values in the field.  

For fields with a string value you will
also see _greater_, _less_, _contains_ and _regex_.   The _greater_ and _less_
operators will compare the strings alphabetically ('cat' is less than 'dog').
The _regex_ operator allows you to write a [Regular Expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#writing_a_regular_expression_pattern) to match
the field value.

<!-- BUG: The _contains_ operator tests whether the value contains a sub-string ('catalytic' contains 'cat'). -->

If the field is a _MultiSelect_ field that can have more than one value
selected, the operators will be _contains-one-of_, _does-not-contain-any-of_, _contains-all-of_ and
_does-not-contain-all-of_.   Also here you will be able to select multiple values.
So, for example, you could check whether the target field _Pet Type_ contains
one of _Dog_ or _Cat_, or that it does not contain any of _Hamster_, _Gerbil_ or _Rat_.

### Operator Reference

The condition builder offers operators organised into three groups.

#### Comparison Operators

For comparing a field's value against a single value.

| Operator | What It Checks |
| -------- | -------------- |
| **equal** | Field value matches the specified value exactly. |
| **not-equal** | Field value does not match the specified value. |
| **greater** | Field value is greater than the specified number. |
| **less** | Field value is less than the specified number. |
| **contains** | Field value contains the specified substring. |
| **regex** | Field value matches a regex pattern (advanced). |
| **contains** | The selected list includes the specified value. |
| **contains-one-of** | The field value includes at least one of the specified values. |
| **does-not-contain-any-of** | The field value includes none of the specified values. |
| **contains-all-of** | The field value includes every one of the specified values. |
| **does-not-contain-all-of** | The field value does not contain all of the specified values. |

## Complex Conditions

The condition editor allows you to combine simple conditions into more complex tests using boolean
connectors.

```{screenshot} designer/boolean-condition.png
:alt: A boolean condition combining two simple conditions on fields
:width: 100%
```

In this example there are two conditions on fields that are combined with
the 'and' operator, so the condition will hold if both simple conditions hold.
You can also use the 'or' operator to combine conditions.

Complex conditions can be as complex as you need them to be with nested
boolean conditions.  In the example below, we combine two 'and' conditions
with an 'or': Either 'Rock' is 'Granite' and 'Advanced' is checked _or_
'Rock' is 'Sandstone' and 'Advanced' is not checked.

```{screenshot} designer/complex-condition.png
:alt: A complex boolean condition.
:width: 100%
```

## Editing Complex Conditions

Editing complex conditions can be a little confusing.  There are two controls on each
condition: the split control (two small rectangles) and the remove control (amber circle with a bar).

The split control can be used to turn a simple condition into a boolean condition.
Clicking this control will create a second simple condition and use the 'and'
operator by default which you can change to 'or' if you need to.

The removal control will remove either the simple condition or complex condition it
refers to.

The 'Add Another Condition' button below a complex condition will add a new clause
into an existing 'or' or 'and' condition.  
