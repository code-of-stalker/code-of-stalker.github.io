import { Redirect } from 'expo-router';
import { TransitionLabScreen } from '../../features/product/screens/TransitionLabScreen';

/** The transition lab is a development tool; the public site sends this address home. */
export default function Transitions() { return __DEV__ ? <TransitionLabScreen /> : <Redirect href="/home" />; }
