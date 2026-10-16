import { useWindowDimensions } from 'react-native';

export function useVisibleViewport() { return { height: useWindowDimensions().height, top: 0 }; }
