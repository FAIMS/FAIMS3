import React from 'react';


export class TestCompE extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <p> Helllo!</p>
        );
    }
}


export class TestComp extends React.Component {
    constructor(props) {
        super(props);
        this.props.compList = [TestCompE];
    }

    render() {
        return (
            <>
                {this.props.compList.map(Comp => ( <Comp />))}
            </>
        );
    }
}
