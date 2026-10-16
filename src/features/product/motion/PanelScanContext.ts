import { createContext, useContext } from 'react';

/** A composed panel owns one reveal; its glass surfaces retain their own contours. */
export const PanelScanContext = createContext(false);
export function useSharedPanelScan() { return useContext(PanelScanContext); }
