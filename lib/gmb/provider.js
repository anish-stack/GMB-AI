import { MockGMBProvider } from "./mockProvider.js";
import { GoogleGMBProvider } from "./googleProvider.js";

/**
 * @typedef {Object} GMBProvider
 * @property {(clientId:number)=>Promise<any>} getProfile
 * @property {(clientId:number,limit?:number)=>Promise<any[]>} getPosts
 * @property {(clientId:number,post:any)=>Promise<any>} createPost
 * @property {(clientId:number)=>Promise<any>} getReviews
 * @property {(clientId:number,days?:number)=>Promise<any>} getPerformance
 */

let cached = null;

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

export function gmbProviderInfo() {
  const p = getGMBProvider();
  return { name: p.name, isMock: p.isMock };
}
