import React from 'react';
import Input from '@material-ui/core/Input';
import Checkbox from '@material-ui/core/Checkbox';
import TextField from '@material-ui/core/TextField';

let componentRegistry: {string?: {string: React.Component}} = {};

//export function NoSuchComponentNamespace(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponentNamespace';
//}
//
//export function NoSuchComponent(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponent';
//}

export function getComponentByName(namespace, componentName) {
    if (componentRegistry[namespace] === undefined) {
        throw new Error(`Unknown namespace ${namespace}`);
    }
    if (componentRegistry[namespace][componentName] === undefined) {
        throw new Error(
            `No component ${componentName} in namespace ${namespace}`
        );
    }
    return componentRegistry[namespace][componentName];
}

export function registerComponent(namespace, componentName, component) {
    let n = getNameSpace(namespace);
    n[componentName] = component;
}

function getNameSpace(namespace) {
    if (componentRegistry[namespace] === undefined) {
        componentRegistry[namespace] = {};
    }
    return componentRegistry[namespace]
}

// This is temporary, need to work out how to best tie this in as a plugin
// system

registerComponent("core-material-ui", "Input", Input);
registerComponent("core-material-ui", "Checkbox", Checkbox);
registerComponent("core-material-ui", "TextField", TextField);
