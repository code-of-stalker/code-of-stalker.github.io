import { Redirect } from 'expo-router';
import Constants from 'expo-constants';

export default function Index() {
  const androidPackage = Constants.expoConfig?.android?.package;
  // Recovery/standalone manifests retain their test entry point. A development
  // client must connect to the Metro server configured for its matching variant.
  const diagnosticBuild = androidPackage === 'com.watchermatrixcheck.recovery' || androidPackage === 'com.watchermatrixcheck.standalone';
  return <Redirect href={diagnosticBuild ? '/network' : '/launch'} />;
}
