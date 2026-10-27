import { Redirect } from 'expo-router';

// Matrix diagnostics need the native SDK. The public site sends this address,
// and its login form, to the product instead.
export default function MatrixDiagnosticsOnWeb() {
  return <Redirect href="/launch" />;
}
