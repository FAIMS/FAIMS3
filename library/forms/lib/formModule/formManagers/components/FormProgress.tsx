import {currentlyVisibleMap, UISpecification} from '@faims3/data-model';
import {useStore} from '@tanstack/react-form';
import React, {useMemo} from 'react';
import {FormProgressBar} from '../../../components';
import {formDataExtractor} from '../../../utils';
import {FaimsForm, FaimsFormData} from '../../types';
import {completion} from '../../utils';
import {FieldVisibilityMap} from '../types';

interface LiveFormProgressProps {
  form: FaimsForm;
  uiSpec: UISpecification;
  formId: string;
  visibilityMap: FieldVisibilityMap;
}

/**
 * Shows a live reloading form progress bar, used during form submission/editing
 *
 * NOTE: This is costly in re-renders so should be used sparingly (as it
 * involves subscribing to the entire form data state)
 */
export const LiveFormProgress: React.FC<LiveFormProgressProps> = props => {
  const data: FaimsFormData = useStore(props.form.store, state => state.values);
  const progress = useMemo(() => {
    return completion({
      uiSpec: props.uiSpec,
      formId: props.formId,
      data,
      visibilityMap: props.visibilityMap,
    });
  }, [data, props.formId, props.form]);
  return <FormProgressBar completion={progress} />;
};

interface StaticFormProgressProps {
  data: FaimsFormData;
  uiSpec: UISpecification;
  formId: string;
}

/**
 * Shows a static (i.e. not live reloading) form progress bar
 */
export const StaticFormProgress: React.FC<StaticFormProgressProps> = props => {
  const visMap = currentlyVisibleMap({
    values: formDataExtractor({fullData: props.data}),
    uiSpec: props.uiSpec,
    viewsetId: props.formId,
  });
  const progress = useMemo(() => {
    return completion({
      uiSpec: props.uiSpec,
      formId: props.formId,
      data: props.data,
      visibilityMap: visMap,
    });
  }, [props.data, props.formId]);
  return <FormProgressBar completion={progress} />;
};
