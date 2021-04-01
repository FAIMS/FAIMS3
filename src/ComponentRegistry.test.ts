import Input from '@material-ui/core/Input';

import {getComponentByName, registerComponent} from './ComponentRegistry';

test("no such namespace", () => {
    expect(
        () => getComponentByName("no-name", "no-comp")
    ).toThrow(
        /unknown namespace/i
    )
});

// This implicitly depends on material-ui being preloaded, should work out a
// better test case
test("no such component", () => {
    expect(
        () => getComponentByName("core-material-ui", "no-comp")
    ).toThrow(
        /no component/i
    )
});

// This implicitly depends on material-ui being preloaded, should work out a
// better test case
test("load input", () => {
    expect(getComponentByName("core-material-ui", "Input")).toEqual(Input)
});
