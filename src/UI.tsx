import React from 'react';

import {TestComp} from './exp';

type Props = {
    project: string;
};

type State = {
    fields: Array<React.Component>;
};

export class FAIMSForm extends React.Component<Props,State> {

    render() {
        return (
            <div>
            <p>{this.props.project} is the current project</p>
            <TestComp />
            </div>
        );
    }

}
