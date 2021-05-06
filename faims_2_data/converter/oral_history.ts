 _id: "ui-specification",
    fields: { // all the fields for a project - views is how we will configure which fields appear when
      'bad-field': { // a test field which is invalid, but does not break the UI
        'component-namespace': 'fakefakefake'
        'component-name': 'NotAComponent'
        'type-returned': 'faims-core::Email'
        'component-parameters': {
        }
        validationSchema: [
        ]
        initialValue: ''
      }
      'email-field': {
        'component-namespace': 'formik-material-ui' // namespace for a set of react components - each "plugin" will have its own namespace
        'component-name': 'TextField' // the component name within the namespace to use
        'type-returned': 'faims-core::Email' // the type of the data the field will return
        'component-parameters': { // parameters to pass to the react component, this different for each component, but allows control of appearance and anything else that needs to be configured
          fullWidth: true,
          name: 'email-field'
          id: 'email-field'
          helperText: 'Some helper text for email, field'
          variant: 'outlined'
          required: true
          InputProps: {
            type: 'email'
          }
          SelectProps: {}
          InputLabelProps: {
            label: 'Email Address'
          }
          FormHelperTextProps: {}
        }
        validationSchema: [ // the yup schema used to validate the data - this will change post-alpha
          ['yup.string'],
          ['yup.email' 'Enter a valid email'],
          ['yup.required']
        ]
        initialValue: '' // the initial value - component dependent
      }
    }
    views: { // these set what appear when
      'start-view': {
        fields: [
          'bad-field'
          'email-field'
        ] // ordering sets appearance order
        'next-view': 'another-view-id' // ignore this, may be used in the future
        'next-view-label': 'Done!'
      }
    }
    start_view: 'start-view' // the view in the views object to show first
