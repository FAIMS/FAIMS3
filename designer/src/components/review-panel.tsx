import { Button } from "@mui/material";
import { useAppSelector } from "../state/hooks";
import { downloadNotebook } from "../state/localStorage";

export const ReviewPanel = () => {

    const notebook = useAppSelector(state => state.notebook);

    return (
        <div>
            <p>Here you can download the notebook JSON file. This can
                then be uploaded to the Fieldmark Conductor server
                by a admin user.</p>

            <Button variant="contained" onClick={() => downloadNotebook(notebook)}>
                Download Notebook
            </Button>
        </div>
    );
};