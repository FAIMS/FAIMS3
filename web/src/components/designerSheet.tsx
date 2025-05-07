import React, {useState} from 'react';
import {MUIWidget} from '../../../designer/src/MUIWidget';

export default function DesignerSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={() => setOpen(true)}
      >
        Open Designer
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end">
          <div className="w-2/3 h-full bg-white shadow-xl overflow-auto">
            <div className="flex justify-end p-2">
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <MUIWidget />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
