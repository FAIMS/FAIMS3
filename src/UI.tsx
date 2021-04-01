import React from 'react';
import Input from '@material-ui/core/Input';

import {getComponentByName} from './ComponentRegistry';
import {getUiSpecForProject} from './dbHelpers';


type FormProps = {
    project: string;
};

type FormState = {
    uiSpec: any;
    currentView: string;
    validateCallback: any;
};

export class FAIMSForm extends React.Component<FormProps,FormState> {
    constructor(props) {
        super(props)
        let uiSpec = getUiSpecForProject(props.project);
        this.state = {
            uiSpec: uiSpec,
            currentView: uiSpec["start-view"],
            validateCallback: () => {return {};},
        };
        this.validate = this.validate.bind(this);
    }

    validate (event) {
        this.save(this.state.validateCallback());
        event.preventDefault(); // Stops the rerender of the page
    }

    save(values) {
        console.log(values);
    }

    updateView(viewName) {
        if (viewName in this.state.uiSpec["views"]) {
            this.setState({currentView: viewName});
            this.forceUpdate();
            // Probably not needed, but we *know* we need to rerender when this
            // changes, so let's be explicit.
        } else {
            throw Error(`No view ${viewName}`);
        }
    }

    setValidateCallback(callback) {
        this.setState({validateCallback: callback});
    }

    getComponentFromField(fieldName:string, view:ViewComponent) {
        let uiSpec = this.state.uiSpec;
        let fields = uiSpec["fields"];
        return this.getComponentFromFieldConfig(fields[fieldName], view);
    }

    getComponentFromFieldConfig(fieldConfig: any, view:ViewComponent) {
        let Component = getComponentByName(
            fieldConfig["component-namespace"], fieldConfig["component-name"]
        );
        return (
            <Component view={view} {...fieldConfig["component-parameters"]} />
        );
    }

    render() {
        let uiSpec = this.state.uiSpec;
        let viewName = this.state.currentView;
        let viewList: Array<string> = uiSpec["views"][viewName]["fields"];
        return (
            <form onSubmit={this.validate}>
            <p>{this.props.project} is the current project</p>
            <ViewComponent viewList={viewList} form={this} />
            <Input type="submit" value="Save" />
            </form>
        );
    }
}

type ViewProps = {
    viewList: any;
    form: FAIMSForm;
};

type ViewState = {
    validationCallbacks: any;
};

export class ViewComponent extends React.Component<ViewProps,ViewState> {
    constructor(props) {
        super(props)
        this.state = {
            validationCallbacks: {},
        };
        this.validate = this.validate.bind(this);
        let form = this.props.form;
        form.setValidateCallback(this.validateCallback);
    }

    validateCallback () {
        console.log("Doing the validation");
        let validatedFormValues = {};
        for (let [name, callback] of this.state.validationCallbacks) {
            validatedFormValues[name] = callback();
        }
        return validatedFormValues;
    }

    validate(event) {
        this.save(this.validateCallback());
        event.preventDefault(); // Stops the rerender of the page
    }

    save(values) {
        console.log(values);
    }

    getForm() {
        return this.props.form;
    }

    registerCallback(name:string, callback: any) {
        this.state.validationCallbacks[name] = callback;
    }

    unregisterCallback(name:string) {
        delete this.state.validationCallbacks[name];
    }

    render() {
        let form = this.props.form;
        return (
            <>
                {this.props.viewList.map((fieldName) => {
                    return form.getComponentFromField(fieldName, this);
                })}
            </>
        );
    }
}
