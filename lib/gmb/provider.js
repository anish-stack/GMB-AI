import { MockGMBProvider } from "./mockProvider.js";
import { GoogleGMBProvider } from "./googleProvider.js";
import { one } from "../db.js";

/**
 * @typedef {Object} GMBProvider
 * @property {(clientId:number)=>Promise<any>} getProfile
 * @property {(clientId:number,limit?:number)=>Promise<any[]>} getPosts
 * @property {(clientId:number,post:any)=>Promise<any>} createPost
 * @property {(clientId:number,postName:string,post:any)=>Promise<any>} updatePost
 * @property {(clientId:number,postName:string)=>Promise<any>} deletePost
 * @property {(clientId:number)=>Promise<any>} getReviews
 * @property {(clientId:number,opts?:any)=>Promise<any>} getPerformance
 * @property {(clientId:number)=>Promise<any>} getAttributes
 * @property {(clientId:number,attrs:any[])=>Promise<any>} updateAttributes
 * @property {(clientId:number)=>Promise<any>} getActionLinks
 * @property {(clientId:number)=>Promise<any>} getAdmins
 */

let cached = null;
let mock = null;
let google = null;

/** Global provider (env GMB_PROVIDER). Used by publishing, which must never silently fall back to mock. */
/** @returns {GMBProvider} */
export function getGMBProvider() {
  if (cached) return cached;
  const want = (process.env.GMB_PROVIDER || "mock").toLowerCase();
  if (want === "google") {
    const g = new GoogleGMBProvider();
    cached = g.isConfigured() ? g : new MockGMBProvider();
  } else {
    cached = new MockGMBProvider();
  }
  return cached;
}

function mockProvider() {
  if (!mock) mock = new MockGMBProvider();
  return mock;
}

export function googleProvider() {
  if (!google) google = new GoogleGMBProvider();
  return google.isConfigured() ? google : null;
}

async function connectedToGoogle(clientId) {
  const row = await one(
    `SELECT c.google_location_name, c.google_account_id, c.gmb_connection_status, p.provider, p.connection_status
       FROM clients c LEFT JOIN gmb_profiles p ON p.client_id=c.id WHERE c.id=? LIMIT 1`,
    [clientId],
  );
  return Boolean(
    row?.google_location_name && row?.google_account_id &&
    (row.gmb_connection_status === "GOOGLE_CONNECTED" || (row.provider === "google" && row.connection_status === "GOOGLE_CONNECTED")),
  );
}

/**
 * Per-client provider for READ / management screens.
 * A client whose listing is actually connected to Google gets the Google
 * provider; everyone else (not connected yet, disconnected, mock mode) gets
 * the mock provider, so one unconnected client can't crash the page.
 */
export async function providerFor(clientId) {
  if (await connectedToGoogle(clientId)) {
    const g = googleProvider();
    if (g) return g;
  }
  return mockProvider();
}

/**
 * Provider for PUBLISHING. A connected client publishes to Google even when
 * GMB_PROVIDER=mock. An unconnected client in google mode fails loudly
 * (never silently "publishes" to mock).
 */
export async function publishProviderFor(clientId) {
  if (await connectedToGoogle(clientId)) {
    const g = googleProvider();
    if (g) return g;
  }
  return getGMBProvider();
}

export function gmbProviderInfo() {
  const p = getGMBProvider();
  return { name: p.name, isMock: p.isMock };
}
