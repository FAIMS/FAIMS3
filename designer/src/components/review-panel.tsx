import { Button } from "@mui/material";
import { useAppSelector } from "../state/hooks";
import { Notebook } from '../state/initial';
import {slugify} from '../state/uiSpec-reducer';

export const ReviewPanel = () => {

    const state = useAppSelector((state: Notebook) => state);

    const downloadNotebook = () => {
        const element = document.createElement("a");
        const file = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        const name = slugify(state.metadata.name as string);
        element.download = `${name}.json`;
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div>
            <p>Here you can download the notebook JSON file. This can
                then be uploaded to the Fieldmark Conductor server
                by a admin user.</p>

            <Button variant="contained" onClick={downloadNotebook}>
                Download Notebook
            </Button>
        </div>
    );
};