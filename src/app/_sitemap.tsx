import { Redirect } from 'expo-router';

/** Replaces the router's built-in sitemap, which listed every page (the admin among them). */
export default function Sitemap() { return <Redirect href="/" />; }
