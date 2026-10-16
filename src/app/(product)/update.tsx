import { Redirect } from 'expo-router';

/** Fresh entry for clients with the older worker that cached all existing routes. */
export default function Update() { return <Redirect href="/launch" />; }
