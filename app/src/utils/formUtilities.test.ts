import {expect, it, describe} from 'vitest';
import {
  formatTimestamp,
  getHridFromValuesAndSpec,
  getRecordContextFromRecord,
  recomputeDerivedFields,
  ValuesObject,
} from './formUtilities';
import {ProjectUIModel, Record} from '@faims3/data-model';
import {RecordContext} from '../gui/components/record/form';
import {prettifyFieldName} from './formUtilities';

/**
 * Test suite for form utility functions including time stamp and templating logic
 */

describe('formatTimestamp', () => {
  it('formats a valid timestamp correctly in UTC', () => {
    const timestamp = 1705324200000;
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
  });

  it('handles morning times correctly in UTC', () => {
    const timestamp = 1705306200000;
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 8:10am');
  });

  it('handles noon correctly in UTC', () => {
    const timestamp = 1705315200000;
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 10:40am');
  });

  it('handles midnight correctly in UTC', () => {
    const timestamp = 1705276800000;
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 12:00am');
  });

  it('handles different timezones', () => {
    const timestamp = 1705324200000;
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
    expect(formatTimestamp(timestamp, 'Australia/Sydney')).toBe(
      '16-01-24 12:10am'
    );
  });

  it('handles invalid inputs gracefully', () => {
    expect(formatTimestamp(null)).toBe('');
    expect(formatTimestamp(undefined)).toBe('');
    expect(formatTimestamp(NaN)).toBe('');
    expect(formatTimestamp(Infinity)).toBe('');
    expect(formatTimestamp('invalid')).toBe('');
  });

  it('handles string timestamps', () => {
    const timestamp = '1705324200000';
    expect(formatTimestamp(timestamp, 'GMT')).toBe('15-01-24 1:10pm');
  });

  it('defaults to local timezone when no timezone specified', () => {
    const timestamp = 1705324200000;
    const result = formatTimestamp(timestamp);
    expect(result).toMatch(/^\d{2}-\d{2}-\d{2} \d{1,2}:\d{2}(am|pm)$/);
  });
});

describe('getRecordContextFromRecord', () => {
  it('creates context from a valid record', () => {
    const record = {
      created: new Date(1705324200000),
      created_by: 'John Smith',
    } as Record;

    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBe(1705324200000);
    expect(context.createdBy).toBe('John Smith');
  });

  it('handles missing fields gracefully', () => {
    const record = {} as Record;
    const context = getRecordContextFromRecord({record});
    expect(context.createdTime).toBeUndefined();
    expect(context.createdBy).toBeUndefined();
  });
});

describe('recomputeDerivedFields', () => {
  const baseUISpec = {
    fields: {
      'regular-field': {
        'component-name': 'TextField',
      },
      'templated-name': {
        'component-name': 'TemplatedStringField',
        'component-parameters': {
          template: 'Created by {{_CREATOR_NAME}} on {{_CREATED_TIME}}',
        },
      },
      'templated-complex': {
        'component-name': 'TemplatedStringField',
        'component-parameters': {
          template: 'Status: {{status}}, Area: {{area}}, ID: {{id}}',
        },
      },
    },
  } as Partial<ProjectUIModel>;

  it('updates templated fields with context variables', () => {
    const values = {
      'regular-field': 'Normal value',
      'templated-name': 'Old value',
    };

    const context: RecordContext = {
      createdBy: 'Jane Doe',
      createdTime: 1705324200000,
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
      context,
    });

    expect(changed).toBe(true);
    expect(values['templated-name']).toMatch(
      /^Created by Jane Doe on \d{2}-\d{2}-\d{2} \d{1,2}:\d{2}(am|pm)$/
    );
    expect(values['regular-field']).toBe('Normal value');
  });

  it('handles conditional templates with #if sections', () => {
    const conditionalUISpec = {
      fields: {
        'templated-status': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template:
              'Status: {{#isActive}}Active{{/isActive}}{{^isActive}}Inactive{{/isActive}}',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-status': 'Old value',
      isActive: true,
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: conditionalUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(true);
    expect(values['templated-status']).toBe('Status: Active');

    values.isActive = false;
    const changed2 = recomputeDerivedFields({
      values,
      uiSpecification: conditionalUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed2).toBe(true);
    expect(values['templated-status']).toBe('Status: Inactive');
  });

  it('handles nested conditional templates', () => {
    const nestedConditionalUISpec = {
      fields: {
        'templated-nested': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template:
              '{{#hasPermission}}{{#isAdmin}}Admin{{/isAdmin}}{{^isAdmin}}User{{/isAdmin}}{{/hasPermission}}{{^hasPermission}}No Access{{/hasPermission}}',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-nested': 'Old value',
      hasPermission: true,
      isAdmin: true,
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: nestedConditionalUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(true);
    expect(values['templated-nested']).toBe('Admin');

    values.isAdmin = false;
    const changed2 = recomputeDerivedFields({
      values,
      uiSpecification: nestedConditionalUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed2).toBe(true);
    expect(values['templated-nested']).toBe('User');

    values.hasPermission = false;
    const changed3 = recomputeDerivedFields({
      values,
      uiSpecification: nestedConditionalUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed3).toBe(true);
    expect(values['templated-nested']).toBe('No Access');
  });

  it('handles arrays in templates with #each', () => {
    const arrayUISpec = {
      fields: {
        'templated-list': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: 'Items: {{#items}}{{name}}{{^last}}, {{/last}}{{/items}}',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-list': 'Old value',
      items: [
        {name: 'First', last: false},
        {name: 'Second', last: false},
        {name: 'Third', last: true},
      ],
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: arrayUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(true);
    expect(values['templated-list']).toBe('Items: First, Second, Third');
  });

  it('updates templated fields with form values', () => {
    const values = {
      'regular-field': 'Normal value',
      'templated-complex': 'Old value',
      status: 'Active',
      area: 'Zone A',
      id: '12345',
    };

    const context: RecordContext = {};

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
      context,
    });

    expect(changed).toBe(true);
    expect(values['templated-complex']).toBe(
      'Status: Active, Area: Zone A, ID: 12345'
    );
  });

  it('handles missing template parameter', () => {
    const invalidUISpec = {
      fields: {
        'templated-invalid': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {},
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-invalid': 'Original value',
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: invalidUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(false);
    expect(values['templated-invalid']).toBe('Original value');
  });

  it('does not update when values are unchanged', () => {
    const simpleUISpec = {
      fields: {
        'templated-greeting': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: 'Hello {{name}}!',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-greeting': 'Hello Jane!',
      name: 'Jane',
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: simpleUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(false);
    expect(values['templated-greeting']).toBe('Hello Jane!');
  });

  it('handles circular references and self-references', () => {
    const circularUISpec = {
      fields: {
        'templated-circular': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: 'Value: {{templated-circular}}',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      'templated-circular': 'Initial',
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: circularUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(true);
    expect(values['templated-circular']).toBe('Value: ');
  });

  it('handles multiple templated fields in correct order', () => {
    const multiTemplateUISpec = {
      fields: {
        template1: {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: 'First {{value}}',
          },
        },
        template2: {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: 'Second {{value}}',
          },
        },
      },
    } as Partial<ProjectUIModel>;

    const values = {
      template1: 'Old1',
      template2: 'Old2',
      value: 'Test',
    };

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: multiTemplateUISpec as unknown as ProjectUIModel,
      context: {},
    });

    expect(changed).toBe(true);
    expect(values['template1']).toBe('First Test');
    expect(values['template2']).toBe('Second Test');
  });

  it('uses default "Unknown User and Unknown Time"', () => {
    const values = {
      'templated-name': 'Old value',
    };

    const context: RecordContext = {};

    const changed = recomputeDerivedFields({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
      context,
    });

    expect(changed).toBe(true);
    expect(values['templated-name']).toMatch(
      /^Created by Unknown User on Unknown Time$/
    );
  });
});

describe('getHridFromValuesAndSpec', () => {
  // This is used to help test out the old/new hrid - it is a subset of ProjectUIModel
  const baseUISpec = {
    fields: {
      regularFieldA: {},
      hridOldFieldA: {},
      newHridFieldA: {},
      regularFieldB: {},
      hridOldFieldB: {},
      newHridFieldB: {},
    },
    views: {
      sectionA: {fields: ['regularFieldA', 'hridOldFieldA', 'newHridFieldA']},
      sectionB: {fields: ['regularFieldB', 'hridOldFieldB', 'newHridFieldB']},
    },
    viewsets: {
      A: {views: ['sectionA']},
      B: {views: ['sectionB']},
    } as {[key: string]: {views: string[]; hridField?: string}},
  };

  it('finds old hrid field properly', () => {
    const values: ValuesObject = {
      hridOldFieldA: 'test',
    };
    const result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.equal('test');
  });

  it('finds old hrid field properly on B view', () => {
    const values: ValuesObject = {
      hridOldFieldB: 'test',
    };
    const result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.equal('test');
  });

  it('returns undefined if old hrid is not present', () => {
    const values: ValuesObject = {};
    const result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.be.undefined;
  });

  it('finds new hrid on either form', () => {
    let values: ValuesObject = {
      newHridFieldA: 'testA',
    };

    // set hrid field for A
    baseUISpec.viewsets['A'].hridField = 'newHridFieldA';

    let result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.equal('testA');
    // unset hrid field for A
    baseUISpec.viewsets['A'].hridField = undefined;

    values = {
      newHridFieldB: 'testB',
    };

    // set hrid field for B
    baseUISpec.viewsets['B'].hridField = 'newHridFieldB';

    result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.equal('testB');

    // unset hrid field for B
    baseUISpec.viewsets['B'].hridField = undefined;
  });

  it('prioritises new hrid over old', () => {
    const values: ValuesObject = {
      newHridFieldA: 'new',
      hridOldFieldA: 'old',
    };

    // set hrid field for A
    baseUISpec.viewsets['A'].hridField = 'newHridFieldA';

    const result = getHridFromValuesAndSpec({
      values,
      uiSpecification: baseUISpec as unknown as ProjectUIModel,
    });

    expect(result).to.equal('new');
    // unset hrid field for A
    baseUISpec.viewsets['A'].hridField = undefined;
  });
});

describe('prettifyFieldName', () => {
  it('replaces hyphens with spaces', () => {
    expect(prettifyFieldName('user-name')).toBe('user name');
    expect(prettifyFieldName('shipping-address-details')).toBe(
      'shipping address details'
    );
  });

  it('removes numeric characters', () => {
    expect(prettifyFieldName('order123')).toBe('order');
    expect(prettifyFieldName('item-456-status')).toBe('item status');
  });

  it('handles multiple consecutive hyphens', () => {
    expect(prettifyFieldName('user--name')).toBe('user name');
    expect(prettifyFieldName('field---value')).toBe('field value');
  });

  it('handles numeric characters with hyphens', () => {
    expect(prettifyFieldName('user-123-type')).toBe('user type');
    expect(prettifyFieldName('order-98-status-45')).toBe('order status');
  });

  it('trims leading and trailing whitespace', () => {
    expect(prettifyFieldName('user-123-')).toBe('user');
    expect(prettifyFieldName('-456-status')).toBe('status');
  });

  it('handles empty string input', () => {
    expect(prettifyFieldName('')).toBe('');
  });

  it('returns original string if no changes needed', () => {
    expect(prettifyFieldName('username')).toBe('username');
    expect(prettifyFieldName('status')).toBe('status');
  });

  // New tests for CamelCase handling
  it('splits basic CamelCase', () => {
    expect(prettifyFieldName('userName')).toBe('user Name');
    expect(prettifyFieldName('firstName')).toBe('first Name');
    expect(prettifyFieldName('userPostalCode')).toBe('user Postal Code');
  });

  it('handles consecutive capitals', () => {
    expect(prettifyFieldName('APIResponse')).toBe('API Response');
    expect(prettifyFieldName('JSONData')).toBe('JSON Data');
    expect(prettifyFieldName('userID')).toBe('user ID');
  });

  it('preserves case in split words', () => {
    expect(prettifyFieldName('MyUserName')).toBe('My User Name');
    expect(prettifyFieldName('LastLoginTime')).toBe('Last Login Time');
    expect(prettifyFieldName('UserAPIAccess')).toBe('User API Access');
  });

  it('handles mixed CamelCase and hyphens', () => {
    expect(prettifyFieldName('user-firstName-123')).toBe('user first Name');
    expect(prettifyFieldName('API-userAccess-444')).toBe('API user Access');
    expect(prettifyFieldName('MyUser-lastName')).toBe('My User last Name');
  });

  it('handles edge cases with multiple formats', () => {
    expect(prettifyFieldName('UserAPI-123-lastLoginID')).toBe(
      'User API last Login ID'
    );
    expect(prettifyFieldName('first-userName-ID444')).toBe(
      'first user Name ID'
    );
    expect(prettifyFieldName('API--userAccessID-999')).toBe(
      'API user Access ID'
    );
  });

  it('preserves case in acronyms while splitting', () => {
    expect(prettifyFieldName('MainAPIEndpoint')).toBe('Main API Endpoint');
    expect(prettifyFieldName('UserIDSettings')).toBe('User ID Settings');
    expect(prettifyFieldName('SimpleXMLParser')).toBe('Simple XML Parser');
  });
});
