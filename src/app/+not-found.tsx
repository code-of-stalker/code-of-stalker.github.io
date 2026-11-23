import { Redirect } from 'expo-router';

/** An unknown address opens the app from its start instead of the router's developer page. */
export default function NotFound() { return <Redirect href="/" />; }
