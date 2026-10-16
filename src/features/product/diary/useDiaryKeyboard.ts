// Native screens use KeyboardAvoidingView; the browser has a separate viewport.
export function useDiaryKeyboard() { return { bottomInset: 0, visible: false, viewportHeight: 0 }; }
